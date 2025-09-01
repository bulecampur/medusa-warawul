import { Logger, OrderDTO } from "@medusajs/framework/types";
import LexofficeService from "../lexoffice/service";
import MinioService from "../minio/service";
import ProductSyncService from "../product_sync/service";

type InjectedDependencies = {
  logger: Logger;
};

export interface GeneratedInvoice {
  invoiceId: string;
  invoiceNumber: string | null;
  documentFileId: string;
  pdfUrl: string;
  minioKey: string;
}

class InvoiceGeneratorService {
  private logger: Logger;
  private lexoffice: LexofficeService;
  private minio: MinioService;
  private productSync: ProductSyncService;

  constructor({ logger }: InjectedDependencies) {
    this.logger = logger;

    // Initialize services with environment variables
    this.lexoffice = new LexofficeService(
      { logger },
      { api_key: process.env.LEXWARE_API_KEY || "" }
    );

    this.minio = new MinioService(
      { logger },
      {
        endpoint: process.env.S3_ENDPOINT || "",
        accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
        bucket: process.env.S3_BUCKET || "",
        region: process.env.S3_REGION || "auto",
        fileUrl: process.env.S3_FILE_URL,
      }
    );

    this.productSync = new ProductSyncService({ logger });
  }

  async generateInvoice(order: OrderDTO): Promise<GeneratedInvoice> {
    this.logger.info(`Generating invoice for order ${order.id}`);

    try {
      // Create or get contact in Lexoffice
      const contactData = this.mapOrderToContact(order);
      let contactId: string;

      this.logger.info(
        `Contact data being sent to Lexoffice: ${JSON.stringify(
          contactData,
          null,
          2
        )}`
      );

      try {
        const contact = await this.lexoffice.createContact(contactData);
        contactId = contact.id;
        this.logger.info(`Successfully created contact: ${contactId}`);
      } catch (error) {
        // If contact creation fails, we'll create invoice without contact
        this.logger.warn(
          "Failed to create contact, creating invoice without contact reference"
        );
        this.logger.error("Contact creation error details:", error);
        contactId = ""; // Empty contactId means invoice will use address directly
      }

      // Create invoice in Lexoffice
      const invoiceData = await this.mapOrderToInvoice(order, contactId);

      // Debug logging to see what's being sent
      this.logger.info(
        `Invoice data being sent to Lexoffice: ${JSON.stringify(
          invoiceData,
          null,
          2
        )}`
      );

      // Log line items specifically for debugging
      this.logger.info(`Line items count: ${invoiceData.lineItems.length}`);
      invoiceData.lineItems.forEach((item: any, index: number) => {
        this.logger.info(
          `Line item ${index}: ${JSON.stringify(item, null, 2)}`
        );
      });

      let invoice: any;
      try {
        invoice = await this.lexoffice.createInvoice(invoiceData);
        this.logger.info(
          `Invoice creation returned fields: ${Object.keys(invoice).join(", ")}`
        );
        this.logger.info(
          `Invoice ID: ${invoice.id}, documentFileId: ${
            invoice.documentFileId || "MISSING"
          }, voucherStatus: ${invoice.voucherStatus || "UNKNOWN"}`
        );
      } catch (error) {
        this.logger.error(`Lexoffice API call failed: ${error.message}`);
        this.logger.error(`Full error details:`, error);
        throw error;
      }

      // With finalize=true flag, invoice is created and finalized in one step
      // We can download the PDF directly using the invoice ID (no need for deprecated documentFileId)
      this.logger.info(
        `Invoice ${invoice.id} created with finalize=true, ready for PDF download`
      );

      // Verify invoice is finalized and get invoice number for title update
      let invoiceStatus = "unknown";
      let invoiceNumber = null;
      try {
        const invoiceDetails = await this.lexoffice.getInvoice(invoice.id);
        invoiceStatus = invoiceDetails.voucherStatus || "unknown";
        invoiceNumber = invoiceDetails.voucherNumber || null;
        this.logger.info(
          `Invoice ${invoice.id} status: ${invoiceStatus}, number: ${invoiceNumber}`
        );

        if (invoiceStatus === "draft") {
          // If still in draft, try manual finalization
          this.logger.warn(
            `Invoice ${invoice.id} is still in draft status, attempting manual finalization...`
          );
          try {
            await this.lexoffice.finalizeInvoice(invoice.id);
            this.logger.info(
              `Manual finalization completed for invoice ${invoice.id}`
            );

            // Get updated invoice details after finalization
            const finalizedDetails = await this.lexoffice.getInvoice(
              invoice.id
            );
            invoiceNumber = finalizedDetails.voucherNumber || invoiceNumber;
            this.logger.info(
              `Invoice number after finalization: ${invoiceNumber}`
            );
          } catch (finalizeError) {
            this.logger.error(
              `Manual finalization failed: ${finalizeError.message}`
            );
            throw new Error(
              `Invoice ${invoice.id} could not be finalized and remains in draft status`
            );
          }
        }
      } catch (error) {
        this.logger.warn(
          `Could not verify invoice status: ${error.message}, proceeding with PDF download attempt...`
        );
      }

      // Download the PDF using the direct file endpoint (no documentFileId needed)
      const pdfBuffer = await this.lexoffice.downloadInvoicePdf(invoice.id);

      // Upload to MinIO with branded filename
      const invoiceFilename = invoiceNumber
        ? `Warawul Coffee Rechnung ${invoiceNumber}.pdf`
        : `Warawul Coffee Rechnung ${invoice.id}.pdf`;

      const minioKey = `invoices/${order.id}/${invoiceFilename}`;
      const uploadResult = await this.minio.uploadFile(
        minioKey,
        pdfBuffer,
        "application/pdf",
        {
          orderId: order.id,
          invoiceId: invoice.id,
          invoiceNumber: invoiceNumber || null,
          invoiceStatus: invoiceStatus,
        }
      );

      this.logger.info(`Invoice generated successfully for order ${order.id}`);

      return {
        invoiceId: invoice.id,
        invoiceNumber: invoiceNumber,
        documentFileId: invoice.id, // Use invoice ID since documentFileId is deprecated
        pdfUrl: uploadResult.url,
        minioKey: uploadResult.key,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate invoice for order ${order.id}`,
        error
      );
      throw error;
    }
  }

  async getInvoicePdf(minioKey: string): Promise<Buffer> {
    this.logger.info(`Retrieving invoice PDF from MinIO: ${minioKey}`);
    return await this.minio.downloadFile(minioKey);
  }

  private mapOrderToContact(order: OrderDTO): any {
    const address = order.shipping_address || order.billing_address;
    const customer = (order as any).customer;

    // Determine if this is a company or person contact
    const isCompany = address?.company && address.company.trim() !== "";

    // Base contact structure following Lexoffice API format
    const contactData: any = {
      roles: {
        customer: {}, // Required: mark as customer role
      },
    };

    if (isCompany) {
      // Company contact - requires company object with name
      if (!address.company || address.company.trim() === "") {
        throw new Error("Company name is required for company contacts");
      }

      contactData.company = {
        name: address.company.trim(),
      };

      // Add company address if available (these are optional according to docs)
      if (address?.address_1) {
        contactData.addresses = {
          billing: [
            {
              street: address.address_1,
              city: address?.city || "",
              zip: address?.postal_code || "",
              countryCode: address?.country_code?.toUpperCase() || "DE",
            },
          ],
        };
      }
    } else {
      // Person contact - requires person object with first and last name
      const firstName = customer?.first_name || address?.first_name;
      const lastName = customer?.last_name || address?.last_name;

      if (!firstName && !lastName) {
        throw new Error(
          "Either first name or last name is required for person contacts"
        );
      }

      contactData.person = {
        salutation: "Herr/Frau",
        firstName: firstName || "Kunde",
        lastName: lastName || "Unbekannt",
      };
    }

    // Add email addresses if available (must be valid email)
    const email = customer?.email || order.email;
    if (email && email.includes("@")) {
      contactData.emailAddresses = {
        business: [email.trim()],
      };
    }

    // Add phone numbers if available (must not be empty)
    if (address?.phone && address.phone.trim() !== "") {
      contactData.phoneNumbers = {
        business: [address.phone.trim()],
      };
    }

    return contactData;
  }

  private async mapOrderToInvoice(
    order: OrderDTO,
    contactId?: string
  ): Promise<any> {
    const address = order.billing_address || order.shipping_address;

    // Map order items to invoice line items (async operations)
    const lineItemPromises =
      order.items?.map(async (item) => {
        const unitPrice =
          typeof item.unit_price === "number"
            ? item.unit_price
            : parseFloat(String(item.unit_price || "0"));

        const quantity =
          typeof item.quantity === "number"
            ? item.quantity
            : parseFloat(String(item.quantity || "1"));

        this.logger.info(
          `Item ${item.id}: unitPrice=${unitPrice}, quantity=${quantity}, unit_price_raw=${item.unit_price}`
        );

        // Medusa prices already INCLUDE tax (gross prices)
        // We need to calculate the net amount by removing the tax
        // Extract tax rate from the item's tax_lines (use first tax line if multiple exist)
        const taxRate =
          item.tax_lines && item.tax_lines.length > 0
            ? item.tax_lines[0].rate || 19 // Use actual tax rate from Medusa
            : 19; // Fallback to German VAT rate

        const grossAmount = parseFloat(unitPrice.toFixed(4)); // Medusa price is gross (includes tax)
        const netAmount = parseFloat(
          (grossAmount / (1 + taxRate / 100)).toFixed(4)
        ); // Calculate net by removing tax

        this.logger.info(
          `Item ${item.id}: taxRate=${taxRate}% (from tax_lines), grossAmount: ${grossAmount}, calculated netAmount: ${netAmount}`
        );

        // Get the Lexoffice UUID from the variant metadata (stored during product sync)
        const variantId = item.variant_id || item.id;
        let lexofficeVariantId = null;

        // First try to get from variant metadata (preferred method)
        if ((item as any).variant?.metadata?.lexoffice_uuid) {
          const candidateUuid = (item as any).variant.metadata.lexoffice_uuid;
          this.logger.info(
            `Found Lexoffice UUID from variant metadata for ${variantId}: ${candidateUuid}`
          );

          // Validate that the article exists in Lexoffice
          try {
            await this.lexoffice.getProduct(candidateUuid);
            lexofficeVariantId = candidateUuid as string;
            this.logger.info(
              `Validated Lexoffice article ${candidateUuid} exists`
            );
          } catch (error) {
            this.logger.warn(
              `Lexoffice article ${candidateUuid} does not exist, attempting to recreate it`
            );

            // Try to recreate the article in Lexoffice
            try {
              const newArticle = await this.createMissingArticle(
                item,
                variantId
              );
              lexofficeVariantId = newArticle.id;
              this.logger.info(
                `Successfully recreated Lexoffice article ${newArticle.id} for variant ${variantId}`
              );
            } catch (createError) {
              this.logger.error(
                `Failed to recreate article for variant ${variantId}:`,
                createError
              );
              lexofficeVariantId = null;
            }
          }
        } else {
          // Fallback to in-memory mappings
          const candidateUuid = variantId
            ? this.productSync.getLexofficeVariantId(variantId)
            : null;

          if (candidateUuid) {
            this.logger.info(
              `Found Lexoffice UUID from sync mappings for ${variantId}: ${candidateUuid}`
            );

            // Validate that the article exists in Lexoffice
            try {
              await this.lexoffice.getProduct(candidateUuid);
              lexofficeVariantId = candidateUuid as string;
              this.logger.info(
                `Validated Lexoffice article ${candidateUuid} exists`
              );
            } catch (error) {
              this.logger.warn(
                `Lexoffice article ${candidateUuid} does not exist, attempting to recreate it`
              );

              // Try to recreate the article in Lexoffice
              try {
                const newArticle = await this.createMissingArticle(
                  item,
                  variantId
                );
                lexofficeVariantId = newArticle.id;
                this.logger.info(
                  `Successfully recreated Lexoffice article ${newArticle.id} for variant ${variantId}`
                );
              } catch (createError) {
                this.logger.error(
                  `Failed to recreate article for variant ${variantId}:`,
                  createError
                );
                lexofficeVariantId = null;
              }
            }
          } else {
            this.logger.warn(
              `No Lexoffice UUID found for variant ${variantId} in metadata or mappings, generating temporary ID`
            );
          }
        }

        // If no valid UUID found, create the article on-the-fly
        if (!lexofficeVariantId) {
          try {
            const newArticle = await this.createMissingArticle(item, variantId);
            lexofficeVariantId = newArticle.id;
            this.logger.info(
              `Created new Lexoffice article ${newArticle.id} for variant ${variantId}`
            );
          } catch (createError) {
            this.logger.error(
              `Failed to create article for variant ${variantId}:`,
              createError
            );
            throw new Error(
              `Cannot create invoice: Unable to create article for variant ${variantId}`
            );
          }
        }

        return {
          id: lexofficeVariantId,
          type: "material" as const,
          name: item.product_title || "Product",
          quantity: quantity,
          unitName: "Stück",
          unitPrice: {
            currency: order.currency_code?.toUpperCase() || "EUR",
            netAmount: netAmount,
            grossAmount: grossAmount,
            taxRatePercentage: taxRate,
          },
          lineItemAmount: parseFloat((netAmount * quantity).toFixed(4)), // Round to 4 decimal places
        };
      }) || [];

    // Wait for all line items to be processed
    const lineItems = await Promise.all(lineItemPromises);

    // Check if all items in the order are coffee products for special shipping tax logic
    const allItemsAreCoffee = this.areAllItemsCoffee(order.items || []);
    this.logger.info(`All items are coffee products: ${allItemsAreCoffee}`);

    // Add shipping as a line item if present
    if (order.shipping_methods && order.shipping_methods.length > 0) {
      const shippingPromises = order.shipping_methods.map(async (method) => {
        const shippingAmount =
          typeof method.amount === "number"
            ? method.amount
            : parseFloat(String(method.amount || "0"));

        this.logger.info(
          `Shipping ${method.name}: amount=${shippingAmount}, amount_raw=${method.amount}`
        );

        // Medusa shipping prices also already INCLUDE tax (gross prices)
        // Extract tax rate from the shipping method's tax_lines, but apply special logic for coffee-only orders
        let taxRate =
          method.tax_lines && method.tax_lines.length > 0
            ? method.tax_lines[0].rate || 19 // Use actual tax rate from Medusa
            : 19; // Fallback to German VAT rate

        // Special rule: If all items in cart are coffee products, use reduced 7% tax rate for shipping
        if (allItemsAreCoffee) {
          taxRate = 7;
          this.logger.info(
            `Applying reduced tax rate (7%) to shipping because all items are coffee products`
          );
        }

        const grossAmount = parseFloat(shippingAmount.toFixed(4)); // Medusa shipping is gross (includes tax)
        const netAmount = parseFloat(
          (grossAmount / (1 + taxRate / 100)).toFixed(4)
        ); // Calculate net by removing tax

        this.logger.info(
          `Shipping ${method.name}: taxRate=${taxRate}% (from tax_lines), grossAmount: ${grossAmount}, calculated netAmount: ${netAmount}`
        );

        // Get or create shipping article in Lexoffice
        const shippingArticleId = await this.getOrCreateShippingArticle(
          method.name || "Versandkosten",
          taxRate
        );

        return {
          id: shippingArticleId,
          type: "service" as const,
          name: method.name || "Versandkosten",
          quantity: 1,
          unitName: "Stück",
          unitPrice: {
            currency: order.currency_code?.toUpperCase() || "EUR",
            netAmount: netAmount,
            grossAmount: grossAmount,
            taxRatePercentage: taxRate,
          },
          lineItemAmount: parseFloat(netAmount.toFixed(4)), // Round to 4 decimal places
        };
      });

      // Wait for all shipping items to be processed and add them to line items
      const shippingItems = await Promise.all(shippingPromises);
      lineItems.push(...(shippingItems as any));
    }

    // Calculate totals (values already in euros)
    this.logger.info(
      `Order totals - subtotal: ${order.subtotal}, total: ${order.total}, shipping_total: ${order.shipping_total}`
    );
    const totalNet = parseFloat((Number(order.subtotal) || 0).toFixed(4));
    const totalGross = parseFloat((Number(order.total) || 0).toFixed(4));
    const totalTax = parseFloat((totalGross - totalNet).toFixed(4));
    this.logger.info(
      `Using totals rounded to 4 decimals - totalNet: ${totalNet}, totalGross: ${totalGross}, totalTax: ${totalTax}`
    );

    // Format dates according to Lexoffice API requirements
    // API expects: yyyy-MM-ddTHH:mm:ss.SSSXXX (RFC 3339/ISO 8601 format)
    const originalDate = order.created_at
      ? new Date(order.created_at)
      : new Date();

    // Format to RFC 3339/ISO 8601 format as required by Lexoffice API
    const voucherDate = originalDate.toISOString();
    const shippingDate = originalDate.toISOString();

    this.logger.info(`Original order.created_at: ${order.created_at}`);
    this.logger.info(`Parsed Date object: ${originalDate}`);
    this.logger.info(`Formatted voucherDate (RFC 3339): ${voucherDate}`);
    this.logger.info(`Formatted shippingDate: ${shippingDate}`);

    return {
      voucherDate: voucherDate, // Use RFC 3339/ISO 8601 format as required by Lexoffice API
      language: "de",
      address: {
        contactId: contactId || undefined,
        name:
          address?.company || `${address?.first_name} ${address?.last_name}`,
        street: address?.address_1,
        city: address?.city,
        zip: address?.postal_code,
        countryCode: address?.country_code?.toUpperCase(),
      },
      lineItems,
      totalPrice: {
        currency: order.currency_code?.toUpperCase() || "EUR",
        totalNetAmount: totalNet,
        totalGrossAmount: totalGross,
        totalTaxAmount: totalTax,
      },
      shipping: {
        shippingDate: shippingDate,
        shippingType: "delivery",
      },
      taxConditions: {
        taxType:
          address?.company && address.company.trim() !== "" ? "net" : "gross",
      },
      shippingConditions: {
        shippingType: "none",
      },
      paymentConditions: {
        paymentTermDuration: 14,
        paymentTermLabel:
          "Bei Zahlung auf Rechnung besteht eine Zahlungsfrist von 14 Tagen. Die Ware bleibt bis zum Zahlungseingang in unserem Besitz.",
      },
      title: "Rechnung",
      introduction: `Vielen Dank für Ihre Bestellung (${order.display_id}).`,
      remark:
        "Vielen Dank für deinen Einkauf! Bei Fragen zu deiner Bestellung, schreibe uns einfach eine E-Mail an orders@warawul.coffee. Dein Warawul Team",
    };
  }

  /**
   * Create a missing article in Lexoffice when a referenced UUID doesn't exist
   */
  private async createMissingArticle(
    orderItem: any,
    variantId: string
  ): Promise<any> {
    this.logger.info(
      `Creating missing Lexoffice article for variant ${variantId}`
    );

    // Extract basic product information from the order item
    // Ensure article number is within Lexoffice limit (18 chars)
    const originalArticleNumber = orderItem.variant_sku || variantId;
    const articleNumber =
      originalArticleNumber.length > 18
        ? originalArticleNumber.substring(0, 18)
        : originalArticleNumber;

    if (originalArticleNumber.length > 18) {
      this.logger.warn(
        `Article number truncated from "${originalArticleNumber}" to "${articleNumber}" (${articleNumber.length} chars)`
      );
    }

    // Extract tax rate from the item's tax_lines for article creation
    const taxRate =
      orderItem.tax_lines && orderItem.tax_lines.length > 0
        ? orderItem.tax_lines[0].rate || 19 // Use actual tax rate from Medusa
        : 19; // Fallback to German VAT rate

    const articleData = {
      title: orderItem.product_title || `Product ${variantId}`,
      description: orderItem.variant_title
        ? `${orderItem.product_title} - ${orderItem.variant_title}`
        : orderItem.product_title || "",
      type: "PRODUCT" as const,
      articleNumber: articleNumber,
      unitName: "Stück",
      price: {
        netPrice: orderItem.unit_price || 0, // Values already in euros
        leadingPrice: "NET" as const,
        taxRate: taxRate, // Use dynamic tax rate from Medusa
      },
    };

    // Create the article in Lexoffice
    const newArticle = await this.lexoffice.createProduct(articleData);

    // Update the variant metadata with the new UUID
    try {
      // This would typically update the database, but for now we'll just log it
      this.logger.info(
        `Article created: ${newArticle.id}. Update variant ${variantId} metadata with this UUID`
      );
    } catch (error) {
      this.logger.warn(
        `Could not update variant metadata for ${variantId}: ${error}`
      );
    }

    return newArticle;
  }

  /**
   * Get or create a shipping article in Lexoffice
   * This ensures we have a valid article ID for shipping costs
   */
  private async getOrCreateShippingArticle(
    shippingMethodName: string,
    taxRate: number = 19
  ): Promise<string> {
    // Create short article number (max 18 chars for Lexoffice)
    // Use a hash-based approach to ensure uniqueness while staying under limit
    const cleanMethodName = shippingMethodName
      .replace(/\s+/g, "")
      .toUpperCase();
    const methodHash =
      cleanMethodName.length > 0 ? cleanMethodName.substring(0, 10) : "DEFAULT";
    const shippingArticleNumber = `SHIP-${methodHash}`;

    // Ensure article number is within 1-18 character range
    if (
      shippingArticleNumber.length === 0 ||
      shippingArticleNumber.length > 18
    ) {
      throw new Error(
        `Invalid shipping article number length: "${shippingArticleNumber}" (${shippingArticleNumber.length} chars)`
      );
    }

    this.logger.info(
      `Creating shipping article number: "${shippingArticleNumber}" (${shippingArticleNumber.length} chars) for method: "${shippingMethodName}"`
    );

    try {
      // First try to find existing shipping article by SKU
      const existingArticles = await this.lexoffice.getProductBySku(
        shippingArticleNumber
      );

      if (existingArticles?.content && existingArticles.content.length > 0) {
        const existingArticle = existingArticles.content[0];
        this.logger.info(
          `Found existing shipping article: ${existingArticle.id} for ${shippingMethodName}`
        );
        return existingArticle.id;
      }
    } catch (error) {
      this.logger.info(
        `No existing shipping article found for ${shippingMethodName}, will create new one`
      );
    }

    // Create new shipping article
    try {
      const shippingArticleData = {
        title: shippingMethodName,
        description: `Versandkosten für ${shippingMethodName}`,
        type: "SERVICE" as const,
        articleNumber: shippingArticleNumber,
        unitName: "Stück",
        price: {
          netPrice: 0, // Default price, will be overridden in invoice
          leadingPrice: "NET" as const,
          taxRate: taxRate, // Use dynamic tax rate
        },
      };

      const newShippingArticle = await this.lexoffice.createProduct(
        shippingArticleData
      );
      this.logger.info(
        `Created new shipping article: ${newShippingArticle.id} for ${shippingMethodName}`
      );

      return newShippingArticle.id;
    } catch (error) {
      this.logger.error(
        `Failed to create shipping article for ${shippingMethodName}:`,
        error
      );
      throw new Error(
        `Cannot create shipping article for ${shippingMethodName}`
      );
    }
  }

  /**
   * Check if all items in the order are coffee products
   * This is used to determine if shipping should use reduced tax rate
   */
  private areAllItemsCoffee(items: any[]): boolean {
    if (!items || items.length === 0) {
      return false;
    }

    return items.every((item) => {
      // Check multiple ways to identify coffee products:
      // 1. product_type field
      // 2. product.type.value field
      // 3. product title/name contains "coffee" (case-insensitive)

      const productType = item.product_type?.toLowerCase() || "";
      const productTypeValue = item.product?.type?.value?.toLowerCase() || "";
      const productTitle = (
        item.product_title ||
        item.product?.title ||
        ""
      ).toLowerCase();

      const isCoffeeProduct =
        productType === "coffee" ||
        productTypeValue === "coffee" ||
        productTitle.includes("coffee") ||
        productTitle.includes("kaffee"); // German word for coffee

      this.logger.info(
        `Item "${
          item.product_title || item.id
        }": productType="${productType}", productTypeValue="${productTypeValue}", title="${productTitle}" -> isCoffee: ${isCoffeeProduct}`
      );

      return isCoffeeProduct;
    });
  }
}

export default InvoiceGeneratorService;
