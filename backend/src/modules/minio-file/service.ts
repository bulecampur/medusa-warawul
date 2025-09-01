import { AbstractFileProviderService, MedusaError } from '@medusajs/framework/utils';
import { Logger } from '@medusajs/framework/types';
import { 
  ProviderUploadFileDTO,
  ProviderDeleteFileDTO,
  ProviderFileResultDTO,
  ProviderGetFileDTO
} from '@medusajs/framework/types';
import { Client } from 'minio';
import path from 'path';
import { ulid } from 'ulid';

type InjectedDependencies = {
  logger: Logger
}

interface MinioServiceConfig {
  endPoint: string
  accessKey: string
  secretKey: string
  bucket?: string
}

export interface MinioFileProviderOptions {
  endPoint: string
  accessKey: string
  secretKey: string
  bucket?: string
}

const DEFAULT_BUCKET = 'medusa-media'

/**
 * Service to handle file storage using MinIO.
 */
class MinioFileProviderService extends AbstractFileProviderService {
  static identifier = 'minio-file'
  protected readonly config_: MinioServiceConfig
  protected readonly logger_: Logger
  protected client: Client
  protected readonly bucket: string

  constructor({ logger }: InjectedDependencies, options: MinioFileProviderOptions) {
    super()
    this.logger_ = logger
    this.config_ = {
      endPoint: options.endPoint,
      accessKey: options.accessKey,
      secretKey: options.secretKey,
      bucket: options.bucket
    }

    // Use provided bucket or default
    this.bucket = this.config_.bucket || DEFAULT_BUCKET
    this.logger_.info(`MinIO service initialized with bucket: ${this.bucket}`)
    this.logger_.info(`MinIO endPoint received: ${this.config_.endPoint}`)

    // Parse endpoint to extract host, port, and SSL settings
    let endPoint: string;
    let port: number | undefined;
    let useSSL: boolean;

    if (this.config_.endPoint.startsWith('http://')) {
      endPoint = this.config_.endPoint.replace('http://', '');
      useSSL = false;
      port = 80;
    } else if (this.config_.endPoint.startsWith('https://')) {
      endPoint = this.config_.endPoint.replace('https://', '');
      useSSL = true;
      port = 443;
    } else {
      // Default to HTTPS if no protocol specified
      endPoint = this.config_.endPoint;
      useSSL = true;
      port = 443;
    }

    // Extract port if specified in endpoint
    const portMatch = endPoint.match(/:(\d+)$/);
    if (portMatch) {
      port = parseInt(portMatch[1]);
      endPoint = endPoint.replace(/:(\d+)$/, '');
    }

    // Initialize Minio client
    this.client = new Client({
      endPoint,
      port,
      useSSL,
      accessKey: this.config_.accessKey,
      secretKey: this.config_.secretKey
    })

    // Initialize bucket and policy
    this.initializeBucket().catch(error => {
      this.logger_.error(`Failed to initialize MinIO bucket: ${error.message}`)
    })
  }

  static validateOptions(options: Record<string, any>) {
    const requiredFields = [
      'endPoint',
      'accessKey',
      'secretKey'
    ]

    requiredFields.forEach((field) => {
      if (!options[field]) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `${field} is required in the provider's options`
        )
      }
    })
  }

  private async initializeBucket(): Promise<void> {
    try {
      // Check if bucket exists
      const bucketExists = await this.client.bucketExists(this.bucket)
      
      if (!bucketExists) {
        // Create the bucket
        await this.client.makeBucket(this.bucket)
        this.logger_.info(`Created bucket: ${this.bucket}`)

        // Set bucket policy to allow public read access
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Sid: 'PublicRead',
              Effect: 'Allow',
              Principal: '*',
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucket}/*`]
            }
          ]
        }

        await this.client.setBucketPolicy(this.bucket, JSON.stringify(policy))
        this.logger_.info(`Set public read policy for bucket: ${this.bucket}`)
      } else {
        this.logger_.info(`Using existing bucket: ${this.bucket}`)
        
        // Verify/update policy on existing bucket
        try {
          const policy = {
            Version: '2012-10-17',
            Statement: [
              {
                Sid: 'PublicRead',
                Effect: 'Allow',
                Principal: '*',
                Action: ['s3:GetObject'],
                Resource: [`arn:aws:s3:::${this.bucket}/*`]
              }
            ]
          }
          await this.client.setBucketPolicy(this.bucket, JSON.stringify(policy))
          this.logger_.info(`Updated public read policy for existing bucket: ${this.bucket}`)
        } catch (policyError) {
          this.logger_.warn(`Failed to update policy for existing bucket: ${policyError.message}`)
        }
      }
    } catch (error) {
      this.logger_.error(`Error initializing bucket: ${error.message}`)
      throw error
    }
  }

  async upload(
    file: ProviderUploadFileDTO
  ): Promise<ProviderFileResultDTO> {
    if (!file) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'No file provided'
      )
    }

    if (!file.filename) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'No filename provided'
      )
    }

    try {
      const parsedFilename = path.parse(file.filename)
      const fileKey = `${parsedFilename.name}-${ulid()}${parsedFilename.ext}`
      const content = Buffer.from(file.content, 'binary')

      // Upload file with public-read access
      await this.client.putObject(
        this.bucket,
        fileKey,
        content,
        content.length,
        {
          'Content-Type': file.mimeType,
          'x-amz-meta-original-filename': file.filename,
          'x-amz-acl': 'public-read'
        }
      )

      // Generate URL using the endpoint and bucket
      let url: string;
      
      // Clean up endpoint to ensure no double protocols
      let cleanEndpoint = this.config_.endPoint;
      
      // Remove any double protocol issues
      if (cleanEndpoint.includes('://http://') || cleanEndpoint.includes('://https://')) {
        // Fix malformed endpoints like "https://http://localhost:9002"
        cleanEndpoint = cleanEndpoint.replace(/^https?:\/\//, '');
      }
      
      if (cleanEndpoint.startsWith('http://') || cleanEndpoint.startsWith('https://')) {
        // Endpoint already includes protocol
        url = `${cleanEndpoint}/${this.bucket}/${fileKey}`;
      } else {
        // No protocol specified, default to http for localhost
        const protocol = cleanEndpoint.includes('localhost') ? 'http' : 'https';
        url = `${protocol}://${cleanEndpoint}/${this.bucket}/${fileKey}`;
      }
      
      this.logger_.info(`Generated clean URL: ${url}`);

      this.logger_.info(`Successfully uploaded file ${fileKey} to MinIO bucket ${this.bucket}`)

      return {
        url,
        key: fileKey
      }
    } catch (error) {
      this.logger_.error(`Failed to upload file: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Failed to upload file: ${error.message}`
      )
    }
  }

  async delete(
    fileData: ProviderDeleteFileDTO
  ): Promise<void> {
    if (!fileData?.fileKey) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'No file key provided'
      )
    }

    try {
      await this.client.removeObject(this.bucket, fileData.fileKey)
      this.logger_.info(`Successfully deleted file ${fileData.fileKey} from MinIO bucket ${this.bucket}`)
    } catch (error) {
      // Log error but don't throw if file doesn't exist
      this.logger_.warn(`Failed to delete file ${fileData.fileKey}: ${error.message}`)
    }
  }

  async getPresignedDownloadUrl(
    fileData: ProviderGetFileDTO
  ): Promise<string> {
    if (!fileData?.fileKey) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'No file key provided'
      )
    }

    try {
      const url = await this.client.presignedGetObject(
        this.bucket,
        fileData.fileKey,
        24 * 60 * 60 // URL expires in 24 hours
      )
      this.logger_.info(`Generated presigned URL for file ${fileData.fileKey}`)
      return url
    } catch (error) {
      this.logger_.error(`Failed to generate presigned URL: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Failed to generate presigned URL: ${error.message}`
      )
    }
  }
}

export default MinioFileProviderService
