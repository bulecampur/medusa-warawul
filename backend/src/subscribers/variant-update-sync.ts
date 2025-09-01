import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import ProductSyncService from "../modules/product_sync/service";

export default async function variantUpdateSyncHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const variantId = data.id;
  const logger = container.resolve("logger");

  try {
    logger.info(`Variant update sync event triggered for variant ${variantId}`);

    // Get the product sync service
    const productSyncService =
      container.resolve<ProductSyncService>("product_sync");

    // Get the product service to retrieve the variant and its product
    const productService = container.resolve("product");

    try {
      // Retrieve the variant with its product information
      const variant = await productService.retrieveProductVariant(variantId, {
        relations: ["product"],
      });

      if (!variant.product) {
        logger.error(`Variant ${variantId} has no associated product`);
        return;
      }

      // Get the full product with all variants
      const product = await productService.retrieveProduct(variant.product.id, {
        relations: ["variants"],
      });

      // Sync the specific variant
      await productSyncService.syncProductVariant(product, variant);

      logger.info(`Successfully synced updated variant ${variantId} to Lexoffice`);
    } catch (retrieveError) {
      logger.error(
        `Failed to retrieve variant ${variantId} for update sync:`,
        retrieveError
      );
      throw retrieveError;
    }
  } catch (error) {
    logger.error(`Failed to sync updated variant ${variantId} to Lexoffice`, error);
    // Don't throw the error to prevent the event from failing
    // In production, you might want to implement retry logic or error reporting
  }
}

export const config: SubscriberConfig = {
  event: "product-variant.updated",
};