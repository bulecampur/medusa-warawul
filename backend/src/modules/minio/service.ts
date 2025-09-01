import { Logger } from "@medusajs/framework/types";
import { Client } from "minio";

type InjectedDependencies = {
  logger: Logger;
};

interface MinioConfig {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region?: string;
  fileUrl?: string;
}

export interface UploadResult {
  url: string;
  key: string;
}

class MinioService {
  private logger: Logger;
  private client: Client;
  private config: MinioConfig;

  constructor({ logger }: InjectedDependencies, config: MinioConfig) {
    this.logger = logger;
    this.config = config;

    // Parse endpoint to extract host and port
    let endPoint: string;
    let port: number | undefined;
    let useSSL: boolean;

    if (config.endpoint.startsWith('http://')) {
      endPoint = config.endpoint.replace('http://', '');
      useSSL = false;
      port = 80;
    } else if (config.endpoint.startsWith('https://')) {
      endPoint = config.endpoint.replace('https://', '');
      useSSL = true;
      port = 443;
    } else {
      // Default to HTTPS if no protocol specified
      endPoint = config.endpoint;
      useSSL = true;
      port = 443;
    }

    // Extract port if specified in endpoint
    const portMatch = endPoint.match(/:(\d+)$/);
    if (portMatch) {
      port = parseInt(portMatch[1]);
      endPoint = endPoint.replace(/:(\d+)$/, '');
    }

    this.client = new Client({
      endPoint,
      port,
      useSSL,
      accessKey: config.accessKeyId,
      secretKey: config.secretAccessKey,
    });

    this.logger.info(`MinIO service initialized with endpoint: ${endPoint}:${port} (SSL: ${useSSL}), bucket: ${config.bucket}`);

    // Initialize bucket
    this.initializeBucket().catch(error => {
      this.logger.error(`Failed to initialize MinIO bucket: ${error.message}`);
    });
  }

  private async initializeBucket(): Promise<void> {
    try {
      const bucketExists = await this.client.bucketExists(this.config.bucket);
      
      if (!bucketExists) {
        await this.client.makeBucket(this.config.bucket);
        this.logger.info(`Created bucket: ${this.config.bucket}`);

        // Set bucket policy for public read access
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Sid: 'PublicRead',
              Effect: 'Allow',
              Principal: '*',
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.config.bucket}/*`]
            }
          ]
        };

        try {
          await this.client.setBucketPolicy(this.config.bucket, JSON.stringify(policy));
          this.logger.info(`Set public read policy for bucket: ${this.config.bucket}`);
        } catch (policyError) {
          this.logger.warn(`Failed to set bucket policy: ${policyError.message}`);
        }
      } else {
        this.logger.info(`Using existing bucket: ${this.config.bucket}`);
      }
    } catch (error) {
      this.logger.error(`Error initializing bucket: ${error.message}`);
      throw error;
    }
  }

  async uploadFile(
    key: string,
    buffer: Buffer,
    contentType: string,
    metadata?: Record<string, any>
  ): Promise<UploadResult> {
    try {
      // Convert metadata to string values as required by MinIO
      const minioMetadata: Record<string, string> = {};
      if (metadata) {
        Object.entries(metadata).forEach(([k, v]) => {
          minioMetadata[k] = v !== null && v !== undefined ? String(v) : '';
        });
      }

      await this.client.putObject(
        this.config.bucket,
        key,
        buffer,
        buffer.length,
        {
          'Content-Type': contentType,
          ...minioMetadata
        }
      );

      // Generate public URL
      const url = this.config.fileUrl 
        ? `${this.config.fileUrl}/${key}`
        : `${this.config.endpoint.startsWith('http') ? this.config.endpoint : `https://${this.config.endpoint}`}/${this.config.bucket}/${key}`;

      this.logger.info(`Successfully uploaded file ${key} to MinIO bucket ${this.config.bucket}`);

      return {
        url,
        key
      };
    } catch (error) {
      this.logger.error(`Failed to upload file ${key}: ${error.message}`);
      throw error;
    }
  }

  async downloadFile(key: string): Promise<Buffer> {
    try {
      this.logger.info(`Downloading file from MinIO: ${key}`);
      
      const stream = await this.client.getObject(this.config.bucket, key);
      const chunks: Buffer[] = [];
      
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          this.logger.info(`Successfully downloaded file ${key} (${buffer.length} bytes)`);
          resolve(buffer);
        });
        stream.on('error', reject);
      });
    } catch (error) {
      this.logger.error(`Failed to download file ${key}: ${error.message}`);
      throw error;
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      await this.client.removeObject(this.config.bucket, key);
      this.logger.info(`Successfully deleted file ${key} from MinIO bucket ${this.config.bucket}`);
    } catch (error) {
      this.logger.warn(`Failed to delete file ${key}: ${error.message}`);
    }
  }
}

export default MinioService;