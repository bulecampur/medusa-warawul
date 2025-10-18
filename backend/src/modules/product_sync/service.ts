import {
  Logger,
  ProductDTO,
  ProductVariantDTO,
  IProductModuleService,
  IEventBusModuleService,
} from "@medusajs/framework/types";
import LexofficeService from "../lexoffice/service";

type InjectedDependencies = {
  logger: Logger;
  productModuleService?: IProductModuleService;
};

interface LexofficeProductMapping {
  medusaProductId: string;
  medusaVariantId: string;
  lexofficeProductId: string;
  lexofficeVariantId: string;
  sku: string;
  lastSynced: Date;
  lastPrice?: number; // Store the last synced price for comparison
}

class ProductSyncService {
  private logger: Logger;
  private lexoffice: LexofficeService;
  private productMappings: Map<string, LexofficeProductMapping> = new Map();
  private productModuleService?: IProductModuleService;
  private eventBusModuleService?: IEventBusModuleService;

  constructor({ logger, productModuleService }: InjectedDependencies) {
    this.logger = logger;
    this.productModuleService = productModuleService;
    this.eventBusModuleService = undefined;

    // Initialize Lexoffice service
    this.lexoffice = new LexofficeService(
      { logger },
      { api_key: process.env.LEXWARE_API_KEY || "" }
    );

    // Load existing mappings from storage (in production, this would be from a database)
    this.loadProductMappings();
  }

  /**
   * Sync a product and its variants to Lexoffice
   */
  async syncProduct(product: ProductDTO): Promise<void> {
    this.logger.info(`Syncing product ${product.id} to Lexoffice`);

    try {
      // Always ensure all variants are synced, regardless of existing mappings
      await this.syncAllVariants(product);

      this.logger.info(
        `Successfully synced product ${product.id} to Lexoffice`
      );
    } catch (error) {
      this.logger.error(
        `Failed to sync product ${product.id} to Lexoffice`,
        error
      );
      throw error;
    }
  }

  /**
   * Sync all variants of a product to Lexoffice
   */
  private async syncAllVariants(product: ProductDTO): Promise<void> {
    // Debug: Log the product structure
    this.logger.info(`Product ${product.id} structure:`);
    this.logger.info(`  Title: ${product.title}`);
    this.logger.info(`  Has variants property: ${"variants" in product}`);
    this.logger.info(`  Variants type: ${typeof product.variants}`);
    this.logger.info(`  Variants value: ${JSON.stringify(product.variants)}`);

    if (!product.variants || product.variants.length === 0) {
      this.logger.warn(
        `Product ${product.id} has no variants, creating product without variants`
      );
      await this.syncProductWithoutVariants(product);
      return;
    }

    this.logger.info(
      `Syncing ${product.variants.length} variants for product ${product.id}`
    );

    // Sync each variant individually
    for (const variant of product.variants) {
      try {
        await this.syncSingleVariant(product, variant);

        // Add delay to avoid rate limiting (3 seconds between variants)
        if (product.variants.indexOf(variant) < product.variants.length - 1) {
          this.logger.info(`Waiting 3 seconds before next variant...`);
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      } catch (error) {
        this.logger.error(`Failed to sync variant ${variant.id}:`, error);
        // Continue with other variants even if one fails
      }
    }
  }

  /**
   * Sync a single variant to Lexoffice
   */
  private async syncSingleVariant(
    product: ProductDTO,
    variant: ProductVariantDTO
  ): Promise<void> {
    this.logger.info(
      `Syncing variant ${variant.id} (${variant.title || variant.sku})`
    );

    // Check if we already have a mapping for this variant
    const existingMapping = this.getVariantMapping(variant.id);
    
    if (existingMapping) {
      this.logger.info(
        `Variant ${variant.id} already mapped to Lexoffice article ${existingMapping.lexofficeVariantId}`
      );
      
      // Try to update the existing article
      try {
        await this.updateVariantInLexoffice(product, variant, existingMapping);
      } catch (updateError) {
        this.logger.warn(`Update failed for variant ${variant.id}: ${updateError.message}`);
        this.logger.info(`Removing invalid mapping and creating new article for variant ${variant.id}`);
        
        // Remove the invalid mapping
        this.productMappings.delete(variant.id);
        this.saveProductMappings();
        
        // Create a new article
        await this.createVariantInLexoffice(product, variant);
      }
    } else {
      // Check if variant already exists in Lexoffice by article number
      const existingVariant = await this.findExistingProductInLexoffice(
        variant.sku || variant.id
      );

      if (existingVariant) {
        this.logger.info(
          `Variant ${variant.id} already exists in Lexoffice as article ${existingVariant.id}`
        );

        // Store the existing mapping
        this.storeVariantMapping({
          medusaProductId: product.id,
          medusaVariantId: variant.id,
          lexofficeProductId: existingVariant.id,
          lexofficeVariantId: existingVariant.id,
          sku: variant.sku || variant.id,
          lastSynced: new Date(),
          lastPrice: 0, // Default price for now
        });

        // Update the variant in the database with the LexOffice UUID
        await this.updateVariantWithLexofficeUuid(variant.id, existingVariant.id);

        // Update the existing variant with current data
        try {
          await this.updateVariantInLexoffice(product, variant, {
            medusaProductId: product.id,
            medusaVariantId: variant.id,
            lexofficeProductId: existingVariant.id,
            lexofficeVariantId: existingVariant.id,
            sku: variant.sku || variant.id,
            lastSynced: new Date(),
            lastPrice: 0, // Default price for now
          });
        } catch (updateError) {
          this.logger.warn(`Update of existing article failed: ${updateError.message}`);
          // Continue anyway, the mapping is stored
        }
      } else {
        this.logger.info(
          `Creating new Lexoffice article for variant ${variant.id}`
        );
        await this.createVariantInLexoffice(product, variant);
      }
    }
  }

  /**
   * Sync a product without variants
   */
  private async syncProductWithoutVariants(product: ProductDTO): Promise<void> {
    // Check if product already exists in Lexoffice by article number
    const existingProduct = await this.findExistingProductInLexoffice(
      product.handle || product.id
    );

    if (existingProduct) {
      this.logger.info(
        `Product ${product.id} already exists in Lexoffice as article ${existingProduct.id}`
      );
      // Store the existing mapping
      this.storeVariantMapping({
        medusaProductId: product.id,
        medusaVariantId: product.id,
        lexofficeProductId: existingProduct.id,
        lexofficeVariantId: existingProduct.id,
        sku: product.handle || product.id,
        lastSynced: new Date(),
        lastPrice: 0,
      });
      return;
    }

    // Create a basic product without variants
    const taxRate = this.getTaxRate(product);
    const lexofficeProductData = {
      title: product.title || `Product ${product.id}`,
      description: product.description || "",
      type: "PRODUCT" as const,
      articleNumber: product.handle || product.id,
      unitName: "Stück",
      price: {
        netPrice: 0, // Default price since we don't have variant pricing
        leadingPrice: "NET" as const,
        taxRate: taxRate,
      },
    };

    this.logger.info(
      `Creating basic Lexoffice article for product ${product.id} with price: 0€ (no variant pricing)`
    );

    const lexofficeProduct =
      await this.lexoffice.createProduct(lexofficeProductData);

    // Store basic mapping
    this.storeVariantMapping({
      medusaProductId: product.id,
      medusaVariantId: product.id,
      lexofficeProductId: lexofficeProduct.id,
      lexofficeVariantId: product.id,
      sku: product.handle || product.id,
      lastSynced: new Date(),
      lastPrice: 0,
    });

    this.logger.info(
      `Successfully created basic Lexoffice article ${lexofficeProduct.id} for product ${product.id}`
    );
  }

  /**
   * Test the Lexoffice API connection and rate limits
   */
  async testApiConnection(): Promise<boolean> {
    try {
      this.logger.info("Testing Lexoffice API connection...");

      // Try to get products to test the API
      const products = await this.lexoffice.getProducts();
      this.logger.info("✅ Lexoffice API connection successful");
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes("429")) {
        this.logger.warn(
          "⚠️ Lexoffice API is rate limited, waiting before proceeding..."
        );
        // Wait 10 seconds before proceeding
        await new Promise((resolve) => setTimeout(resolve, 10000));
        return true; // Continue anyway after waiting
      }

      this.logger.error("❌ Lexoffice API connection failed:", error);
      return false;
    }
  }

  /**
   * Sync existing products from Lexoffice to rebuild mappings
   */
  async syncExistingProductsFromLexoffice(): Promise<void> {
    try {
      this.logger.info(
        "Syncing existing products from Lexoffice to rebuild mappings..."
      );

      const lexofficeProducts = await this.lexoffice.getProducts();

      if (lexofficeProducts && lexofficeProducts.content) {
        this.logger.info(
          `Found ${lexofficeProducts.content.length} existing articles in Lexoffice`
        );

        for (const article of lexofficeProducts.content) {
          if (article.articleNumber) {
            // Store mapping for existing article
            this.storeVariantMapping({
              medusaProductId: article.articleNumber, // Use articleNumber as temporary Medusa ID
              medusaVariantId: article.articleNumber,
              lexofficeProductId: article.id,
              lexofficeVariantId: article.id,
              sku: article.articleNumber,
              lastSynced: new Date(),
              lastPrice: article.price?.netPrice || 0,
            });

            this.logger.info(
              `Mapped existing article: ${article.articleNumber} -> ${article.id}`
            );
          }
        }

        this.logger.info(
          `Successfully synced ${lexofficeProducts.content.length} existing articles`
        );
      }
    } catch (error) {
      this.logger.error(
        "Failed to sync existing products from Lexoffice:",
        error
      );
      // Don't throw - this is not critical for the main sync
    }
  }

  /**
   * Sync a specific product variant to Lexoffice
   */
  async syncProductVariant(
    product: ProductDTO,
    variant: ProductVariantDTO
  ): Promise<void> {
    this.logger.info(
      `Syncing variant ${variant.id} for product ${product.id} to Lexoffice`
    );

    try {
      const existingMapping = this.getVariantMapping(variant.id);

      if (existingMapping) {
        // Update existing variant
        await this.updateVariantInLexoffice(product, variant, existingMapping);
      } else {
        // Create new variant
        await this.createVariantInLexoffice(product, variant);
      }

      this.logger.info(
        `Successfully synced variant ${variant.id} to Lexoffice`
      );
    } catch (error) {
      this.logger.error(
        `Failed to sync variant ${variant.id} to Lexoffice`,
        error
      );
      throw error;
    }
  }

  /**
   * Get the Lexoffice ID for a Medusa product variant
   */
  getLexofficeVariantId(medusaVariantId: string): string | null {
    const mapping = this.getVariantMapping(medusaVariantId);
    return mapping ? mapping.lexofficeVariantId : null;
  }

  /**
   * Get the Lexoffice ID for a Medusa product
   */
  getLexofficeProductId(medusaProductId: string): string | null {
    const mapping = this.getProductMapping(medusaProductId);
    return mapping ? mapping.lexofficeProductId : null;
  }

  /**
   * Create a new variant in Lexoffice
   */
  private async createVariantInLexoffice(
    product: ProductDTO,
    variant: ProductVariantDTO
  ): Promise<void> {
    try {
      const netPrice = await this.getVariantPrice(variant);
      const taxRate = this.getTaxRate(product, variant);

      const variantData = {
        title: this.buildVariantTitle(product, variant),
        description: product.description || "",
        type: "PRODUCT" as const,
        articleNumber: variant.sku || variant.id,
        unitName: "Stück",
        price: {
          netPrice: netPrice,
          leadingPrice: "NET" as const,
          taxRate: taxRate,
        },
      };

      const lexofficeVariant = await this.lexoffice.createProduct(variantData);

      // Store the variant mapping
      this.storeVariantMapping({
        medusaProductId: product.id,
        medusaVariantId: variant.id,
        lexofficeProductId: lexofficeVariant.id,
        lexofficeVariantId: lexofficeVariant.id,
        sku: variant.sku || variant.id,
        lastSynced: new Date(),
      });

      // Update the variant in the database with the LexOffice UUID
      await this.updateVariantWithLexofficeUuid(variant.id, lexofficeVariant.id);

      this.logger.info(
        `Successfully created new Lexoffice article for variant ${variant.id}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to create new Lexoffice article for variant ${variant.id}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Update an existing variant in Lexoffice
   */
  private async updateVariantInLexoffice(
    product: ProductDTO,
    variant: ProductVariantDTO,
    mapping: LexofficeProductMapping
  ): Promise<void> {
    try {
      const currentPrice = await this.getVariantPrice(variant);
      const hasPriceChanged =
        mapping.lastPrice !== undefined && mapping.lastPrice !== currentPrice;

      if (hasPriceChanged) {
        this.logger.info(
          `Price changed for variant ${variant.id}: ${mapping.lastPrice}€ -> ${currentPrice}€`
        );
      }

      // Get the current article to retrieve the version
      this.logger.info(`Getting current version for Lexoffice article ${mapping.lexofficeVariantId}`);
      let currentArticle;
      try {
        currentArticle = await this.lexoffice.getProduct(mapping.lexofficeVariantId);
      } catch (getError) {
        this.logger.warn(`Could not retrieve article ${mapping.lexofficeVariantId}: ${getError.message}`);
        throw new Error(`Article ${mapping.lexofficeVariantId} no longer exists in Lexoffice`);
      }
      
      if (!currentArticle) {
        throw new Error(`Could not get article ${mapping.lexofficeVariantId}`);
      }

      // Get version field (should be a number, including 0)
      const version = currentArticle.version;
      if (version === undefined || version === null) {
        this.logger.warn(`Article ${mapping.lexofficeVariantId} has no version field`);
        this.logger.warn(`Available fields: ${Object.keys(currentArticle).join(', ')}`);
        throw new Error(`Could not get version for article ${mapping.lexofficeVariantId}`);
      }

      this.logger.info(`Retrieved article version: ${version}`);

      const taxRate = this.getTaxRate(product, variant);
      const variantData = {
        title: this.buildVariantTitle(product, variant),
        description: product.description || "",
        type: "PRODUCT" as const,
        articleNumber: variant.sku || variant.id,
        unitName: "Stück",
        price: {
          netPrice: currentPrice,
          leadingPrice: "NET" as const,
          taxRate: taxRate,
        },
        version: version, // Include the current version
      };

      await this.lexoffice.updateProduct(
        mapping.lexofficeVariantId,
        variantData
      );

      // Update the mapping with new price
      mapping.lastSynced = new Date();
      mapping.lastPrice = currentPrice;
      this.storeVariantMapping(mapping);

      this.logger.info(
        `Successfully updated Lexoffice article for variant ${variant.id}${hasPriceChanged ? " with new price" : ""}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to update Lexoffice article for variant ${variant.id}:`,
        error
      );
      throw error;
    }
  }


  /**
   * Get variant price - for now using default pricing
   * TODO: Integrate with Medusa pricing module when relations are available
   */
  private async getVariantPrice(variant: ProductVariantDTO): Promise<number> {
    try {
      // Check if prices are directly available on variant
      if ('prices' in variant && Array.isArray(variant.prices) && variant.prices.length > 0) {
        const price = variant.prices[0];
        this.logger.info(`Found direct price for variant ${variant.id}: ${price.amount} ${price.currency_code}`);
        return this.convertPriceToEuros(price.amount || 0);
      }

      // Check if variant has calculated_price
      if ('calculated_price' in variant && variant.calculated_price) {
        const calculatedPrice = (variant as any).calculated_price;
        if (calculatedPrice.calculated_amount) {
          this.logger.info(`Found calculated price for variant ${variant.id}: ${calculatedPrice.calculated_amount}`);
          return this.convertPriceToEuros(calculatedPrice.calculated_amount);
        }
      }

      // For now, use a default price based on variant SKU pattern
      // You can update this logic based on your pricing strategy
      let defaultPrice = 1999; // 19.99 EUR in cents
      
      if (variant.sku) {
        // Simple pricing logic based on SKU patterns
        const sku = variant.sku.toLowerCase();
        if (sku.includes('shorts')) defaultPrice = 2999; // 29.99 EUR
        else if (sku.includes('sweatpants')) defaultPrice = 4999; // 49.99 EUR  
        else if (sku.includes('sweatshirt')) defaultPrice = 5999; // 59.99 EUR
      }

      this.logger.info(`Using default price for variant ${variant.id} (${variant.sku}): ${defaultPrice/100}€`);
      return this.convertPriceToEuros(defaultPrice);
    } catch (error) {
      this.logger.error(`Error getting price for variant ${variant.id}:`, error);
      return this.convertPriceToEuros(1999); // Fallback to 19.99 EUR
    }
  }

  /**
   * Build a proper title combining product name and variant
   */
  private buildVariantTitle(product: ProductDTO, variant: ProductVariantDTO): string {
    const productName = product.title || `Product ${product.id}`;
    const variantName = variant.title || variant.sku || `Variant ${variant.id}`;
    
    // Create a combined title: "Product Name - Variant"
    return `${productName} - ${variantName}`;
  }

  /**
   * Convert price from cents to euros
   */
  private convertPriceToEuros(priceInCents: number): number {
    if (typeof priceInCents !== "number" || isNaN(priceInCents)) {
      this.logger.warn(`Invalid price value: ${priceInCents}, defaulting to 0`);
      return 0;
    }
    return priceInCents / 100;
  }

  /**
   * Get the appropriate tax rate for a product
   * Lexoffice supports: 0, 7, 19 (as of March 2024)
   */
  private getTaxRate(product: ProductDTO, variant?: ProductVariantDTO): number {
    // Check if product has tax rate information
    if ('tax_rates' in product && Array.isArray(product.tax_rates) && product.tax_rates.length > 0) {
      const taxRate = product.tax_rates[0].rate;
      this.logger.info(`Product ${product.id} has tax rate: ${taxRate}%`);

      return this.mapTaxRateToLexoffice(taxRate);
    }

    // Check if variant has tax rate information
    if (variant && 'tax_rates' in variant && Array.isArray(variant.tax_rates) && variant.tax_rates.length > 0) {
      const taxRate = variant.tax_rates[0].rate;
      this.logger.info(`Variant ${variant.id} has tax rate: ${taxRate}%`);

      return this.mapTaxRateToLexoffice(taxRate);
    }

    // Default to German standard VAT rate
    this.logger.info(
      `No tax rate found for product ${product.id}, using default 19%`
    );
    return 19;
  }

  /**
   * Map Medusa tax rates to Lexoffice supported rates
   * Lexoffice supports: 0, 7, 19 (as of March 2024)
   */
  private mapTaxRateToLexoffice(taxRate: number): number {
    // Validate and map tax rates
    if (taxRate === 0) {
      this.logger.info(`Using 0% tax rate (tax-exempt)`);
      return 0;
    }

    if (taxRate > 0 && taxRate <= 7) {
      this.logger.info(
        `Mapping tax rate ${taxRate}% to Lexoffice 7% (reduced rate)`
      );
      return 7;
    }

    if (taxRate > 7 && taxRate <= 19) {
      this.logger.info(
        `Mapping tax rate ${taxRate}% to Lexoffice 19% (standard rate)`
      );
      return 19;
    }

    // For any other rate, default to 19%
    this.logger.warn(
      `Tax rate ${taxRate}% not supported by Lexoffice, defaulting to 19%`
    );
    return 19;
  }

  /**
   * Find an existing product in Lexoffice by article number
   */
  private async findExistingProductInLexoffice(
    articleNumber: string
  ): Promise<any | null> {
    try {
      this.logger.info(
        `Checking if article ${articleNumber} already exists in Lexoffice...`
      );

      // Try to find by article number
      const existingProducts =
        await this.lexoffice.getProductBySku(articleNumber);

      if (
        existingProducts &&
        existingProducts.content &&
        existingProducts.content.length > 0
      ) {
        const existingProduct = existingProducts.content[0];
        this.logger.info(
          `Found existing article ${existingProduct.id} with title: ${existingProduct.title}`
        );
        return existingProduct;
      }

      this.logger.info(`No existing article found for ${articleNumber}`);
      return null;
    } catch (error) {
      // If there's an error (like 404), the product doesn't exist
      this.logger.info(
        `Article ${articleNumber} not found in Lexoffice (this is expected for new products)`
      );
      return null;
    }
  }

  /**
   * Get product mapping by Medusa product ID
   */
  private getProductMapping(
    medusaProductId: string
  ): LexofficeProductMapping | null {
    // Find any variant mapping for this product
    for (const mapping of this.productMappings.values()) {
      if (mapping.medusaProductId === medusaProductId) {
        return mapping;
      }
    }
    return null;
  }

  /**
   * Get variant mapping by Medusa variant ID
   */
  private getVariantMapping(
    medusaVariantId: string
  ): LexofficeProductMapping | null {
    return this.productMappings.get(medusaVariantId) || null;
  }

  /**
   * Store variant mapping
   */
  private storeVariantMapping(mapping: LexofficeProductMapping): void {
    this.productMappings.set(mapping.medusaVariantId, mapping);
    this.saveProductMappings();
  }

  /**
   * Load product mappings from storage
   */
  private loadProductMappings(): void {
    // In production, this would load from a database
    // For now, we'll use an in-memory map
    this.logger.info("Loading product mappings from storage");
  }

  /**
   * Save product mappings to storage
   */
  private saveProductMappings(): void {
    // In production, this would save to a database
    // For now, we'll just log the action
    this.logger.info(
      `Saving ${this.productMappings.size} product mappings to storage`
    );
  }

  /**
   * Get all product mappings (for debugging/admin purposes)
   */
  getAllMappings(): LexofficeProductMapping[] {
    return Array.from(this.productMappings.values());
  }

  /**
   * Clear all mappings (for testing/reset purposes)
   */
  clearMappings(): void {
    this.productMappings.clear();
    this.logger.info("Cleared all product mappings");
  }

  /**
   * Delete a product and all its variants from Lexoffice
   */
  async deleteProduct(productId: string): Promise<void> {
    this.logger.info(`Deleting product ${productId} from Lexoffice`);

    try {
      // Find all variants for this product
      const productVariants = this.getVariantsByProductId(productId);

      if (productVariants.length === 0) {
        this.logger.warn(`No variants found for product ${productId}`);
        return;
      }

      // Delete each variant from Lexoffice
      for (const mapping of productVariants) {
        try {
          await this.deleteVariantFromLexoffice(mapping);
          // Remove from our mappings
          this.productMappings.delete(mapping.medusaVariantId);
        } catch (error) {
          this.logger.error(
            `Failed to delete variant ${mapping.medusaVariantId} from Lexoffice:`,
            error
          );
          // Continue with other variants even if one fails
        }
      }

      this.saveProductMappings();
      this.logger.info(
        `Successfully deleted ${productVariants.length} variants for product ${productId} from Lexoffice`
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete product ${productId} from Lexoffice`,
        error
      );
      throw error;
    }
  }

  /**
   * Delete a specific variant from Lexoffice
   */
  async deleteProductVariant(variantId: string): Promise<void> {
    this.logger.info(`Deleting variant ${variantId} from Lexoffice`);

    try {
      const mapping = this.getVariantMapping(variantId);

      if (!mapping) {
        this.logger.warn(
          `No mapping found for variant ${variantId}, cannot delete from Lexoffice`
        );
        return;
      }

      await this.deleteVariantFromLexoffice(mapping);

      // Remove from our mappings
      this.productMappings.delete(variantId);
      this.saveProductMappings();

      this.logger.info(
        `Successfully deleted variant ${variantId} from Lexoffice`
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete variant ${variantId} from Lexoffice`,
        error
      );
      throw error;
    }
  }

  /**
   * Delete a variant from Lexoffice using the API
   */
  private async deleteVariantFromLexoffice(
    mapping: LexofficeProductMapping
  ): Promise<void> {
    this.logger.info(
      `Deleting Lexoffice article ${mapping.lexofficeVariantId} for variant ${mapping.medusaVariantId}`
    );

    try {
      await this.lexoffice.deleteProduct(mapping.lexofficeVariantId);
      this.logger.info(
        `Successfully deleted Lexoffice article ${mapping.lexofficeVariantId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete Lexoffice article ${mapping.lexofficeVariantId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get all variant mappings for a specific product
   */
  private getVariantsByProductId(productId: string): LexofficeProductMapping[] {
    const variants: LexofficeProductMapping[] = [];
    for (const mapping of this.productMappings.values()) {
      if (mapping.medusaProductId === productId) {
        variants.push(mapping);
      }
    }
    return variants;
  }

  /**
   * Get the LexOffice UUID for a variant (from mappings)
   */
  getLexofficeUuidForVariant(variantId: string): string | null {
    const mapping = this.getVariantMapping(variantId);
    return mapping ? mapping.lexofficeVariantId : null;
  }

  /**
   * Update variant with LexOffice UUID - updates immediately if productModuleService is available
   */
  private async updateVariantWithLexofficeUuid(
    variantId: string,
    lexofficeUuid: string
  ): Promise<void> {
    try {
      this.logger.info(
        `Variant ${variantId} synced with LexOffice UUID: ${lexofficeUuid}`
      );

      // Update the variant metadata immediately if productModuleService is available
      if (this.productModuleService) {
        try {
          await this.productModuleService.upsertProductVariants([{
            id: variantId,
            metadata: {
              lexoffice_uuid: lexofficeUuid,
            }
          }]);
          this.logger.info(`Successfully updated variant ${variantId} metadata with UUID ${lexofficeUuid}`);
        } catch (updateError) {
          this.logger.warn(
            `Could not update variant metadata immediately for ${variantId}: ${updateError.message}`
          );
          this.logger.info(`Use the "Update UUIDs in Database" button to manually store UUID ${lexofficeUuid} for variant ${variantId}`);
        }
      } else {
        this.logger.info(`ProductModuleService not available. Use the "Update UUIDs in Database" button to store UUID ${lexofficeUuid} for variant ${variantId}`);
      }

    } catch (error) {
      this.logger.error(
        `Error updating variant ${variantId}:`,
        error
      );
    }
  }
}

export default ProductSyncService;
