import { Logger } from "@medusajs/framework/types";

type InjectedDependencies = {
  logger: Logger;
};

type LexofficeOptions = {
  api_key: string;
  organization_id?: string;
};

interface Contact {
  salutation?: string;
  firstName?: string;
  lastName?: string;
  company?: {
    name: string;
    street?: string;
    city?: string;
    zip?: string;
    countryCode?: string;
  };
  emailAddresses?: {
    business?: string[];
    office?: string[];
    private?: string[];
    other?: string[];
  };
  phoneNumbers?: {
    business?: string[];
    office?: string[];
    private?: string[];
    mobile?: string[];
    fax?: string[];
  };
}

interface InvoiceLineItem {
  id: string;
  type: "custom" | "material" | "service" | "text";
  name: string;
  description?: string;
  quantity: number;
  unitName?: string;
  unitPrice: {
    currency: string;
    netAmount: number;
    grossAmount?: number;
    taxRatePercentage: number;
  };
  lineItemAmount?: number;
}

interface InvoiceAddress {
  contactId?: string;
  name?: string;
  street?: string;
  city?: string;
  zip?: string;
  countryCode?: string;
}

interface CreateInvoiceRequest {
  voucherDate?: string; // RFC 3339/ISO 8601 format (e.g., 2023-02-21T00:00:00.000+01:00)
  language?: string;
  address: InvoiceAddress;
  lineItems: InvoiceLineItem[];
  totalPrice: {
    currency: string;
    totalNetAmount?: number;
    totalGrossAmount?: number;
    totalTaxAmount?: number;
  };
  shipping?: {
    shippingDate?: string;
    shippingType?: string;
  };
  shippingConditions?: {
    shippingType?: string;
  };
  taxConditions: {
    taxType: "net" | "gross" | "vatfree";
  };
  paymentConditions: {
    paymentTermLabel?: string;
    paymentTermDuration?: number;
  };
  title?: string;
  introduction?: string;
  remark?: string;
}

interface CreateProductRequest {
  title: string;
  description?: string;
  type: "PRODUCT" | "SERVICE";
  articleNumber?: string;
  gtin?: string;
  note?: string;
  unitName: string;
  price: {
    netPrice?: number;
    grossPrice?: number;
    leadingPrice: "NET" | "GROSS";
    taxRate: number;
  };
}

interface UpdateProductRequest {
  title?: string;
  description?: string;
  type?: "PRODUCT" | "SERVICE";
  articleNumber?: string;
  gtin?: string;
  note?: string;
  unitName?: string;
  price?: {
    netPrice?: number;
    grossPrice?: number;
    leadingPrice?: "NET" | "GROSS";
    taxRate?: number;
  };
  version?: number;
}

class LexofficeService {
  private apiKey: string;
  private organizationId?: string;
  private logger: Logger;
  private baseUrl = "https://api.lexware.io";

  constructor({ logger }: InjectedDependencies, options: LexofficeOptions) {
    this.apiKey = options.api_key;
    this.organizationId = options.organization_id;
    this.logger = logger;
  }

  private async makeRequest(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body?: any,
    retries: number = 0
  ) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
    };

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();

        // Handle rate limiting with exponential backoff
        if (response.status === 429 && retries < 3) {
          const waitTime = Math.pow(2, retries) * 3000; // 3s, 6s, 12s
          this.logger.warn(
            `Rate limit exceeded, waiting ${waitTime}ms before retry ${retries + 1}/3`
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          return this.makeRequest(endpoint, method, body, retries + 1);
        }

        this.logger.error(
          `Lexoffice API error: ${response.status} - ${errorText}`
        );
        throw new Error(
          `Lexoffice API error: ${response.status} - ${errorText}`
        );
      }

      // Handle DELETE requests which might return empty response
      if (method === "DELETE") {
        const contentLength = response.headers.get("content-length");
        if (contentLength === "0" || !contentLength) {
          return {}; // Return empty object for successful DELETE
        }
      }

      return await response.json();
    } catch (error) {
      this.logger.error("Error making request to Lexoffice API", error);
      throw error;
    }
  }

  async createContact(contactData: Contact): Promise<{ id: string }> {
    this.logger.info("Creating contact in Lexoffice");
    return await this.makeRequest("/v1/contacts", "POST", contactData);
  }

  async getContact(contactId: string): Promise<Contact> {
    this.logger.info(`Getting contact ${contactId} from Lexoffice`);
    return await this.makeRequest(`/v1/contacts/${contactId}`);
  }

  async createInvoice(invoiceData: CreateInvoiceRequest): Promise<{
    id: string;
    documentFileId?: string;
    resourceUri: string;
    voucherStatus?: string;
  }> {
    this.logger.info("Creating invoice in Lexoffice with finalize=true flag");
    const response = await this.makeRequest("/v1/invoices?finalize=true", "POST", invoiceData);
    
    // Log the full response to understand the structure
    this.logger.info(`Lexoffice invoice creation response: ${JSON.stringify(response, null, 2)}`);
    
    return response;
  }

  async getInvoice(invoiceId: string): Promise<any> {
    this.logger.info(`Getting invoice ${invoiceId} from Lexoffice`);
    return await this.makeRequest(`/v1/invoices/${invoiceId}`);
  }

  async finalizeInvoice(
    invoiceId: string
  ): Promise<{ documentFileId: string }> {
    this.logger.info(`Finalizing invoice ${invoiceId} in Lexoffice`);
    return await this.makeRequest(`/v1/invoices/${invoiceId}/finalize`, "PUT");
  }

  async downloadInvoicePdf(invoiceId: string): Promise<Buffer> {
    this.logger.info(
      `Downloading invoice PDF for invoice ${invoiceId} using direct file endpoint`
    );

    // Use the new direct file download endpoint instead of deprecated documentFileId approach
    const url = `${this.baseUrl}/v1/invoices/${invoiceId}/file`;
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/pdf",
    };

    try {
      const response = await fetch(url, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Error downloading PDF: ${response.status} - ${errorText}`
        );
        throw new Error(
          `Error downloading PDF: ${response.status} - ${errorText}`
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      this.logger.error("Error downloading invoice PDF", error);
      throw error;
    }
  }

  async createProduct(
    productData: CreateProductRequest
  ): Promise<{ id: string }> {
    this.logger.info("Creating product in Lexoffice");
    return await this.makeRequest("/v1/articles", "POST", productData);
  }

  async updateProduct(
    productId: string,
    productData: UpdateProductRequest
  ): Promise<{ id: string }> {
    this.logger.info(`Updating product ${productId} in Lexoffice`);
    return await this.makeRequest(
      `/v1/articles/${productId}`,
      "PUT",
      productData
    );
  }

  async getProduct(productId: string): Promise<any> {
    this.logger.info(`Getting product ${productId} from Lexoffice`);
    return await this.makeRequest(`/v1/articles/${productId}`);
  }

  async getProductBySku(sku: string): Promise<any> {
    this.logger.info(`Getting product by SKU ${sku} from Lexoffice`);
    return await this.makeRequest(
      `/v1/articles?articleNumber=${encodeURIComponent(sku)}`
    );
  }

  async getProducts(): Promise<any> {
    this.logger.info("Getting all products from Lexoffice");
    return await this.makeRequest("/v1/articles");
  }

  async deleteProduct(productId: string): Promise<void> {
    this.logger.info(`Deleting product ${productId} from Lexoffice`);
    await this.makeRequest(`/v1/articles/${productId}`, "DELETE");
  }

  static validateOptions(options: Record<any, any>) {
    if (!options.api_key) {
      throw new Error(
        "Option `api_key` is required in the Lexoffice service options."
      );
    }
  }
}

export default LexofficeService;
