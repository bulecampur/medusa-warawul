import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import ProductSyncService from "../modules/product_sync/service";

export default async function productSyncHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const productId = data.id;
  const logger = container.resolve("logger");

  try {
    logger.info(`Product sync event triggered for product ${productId}`);

    // Get the product sync service
    const productSyncService =
      container.resolve<ProductSyncService>("product_sync");

    // Get the product service to retrieve the full product data
    const productService = container.resolve("product");

    try {
      const product = await productService.retrieveProduct(productId, {
        relations: ["variants"],
      });

      // Sync the product to Lexoffice
      await productSyncService.syncProduct(product);

      logger.info(`Successfully synced product ${productId} to Lexoffice`);
    } catch (retrieveError) {
      logger.error(
        `Failed to retrieve product ${productId} for sync:`,
        retrieveError
      );

      // Try to get basic product info without relations
      try {
        const basicProduct =
          await productService.retrieveProduct(productId);
        logger.info(
          `Retrieved basic product info for ${productId}, attempting sync with limited data`
        );

        // Sync with basic product info
        await productSyncService.syncProduct(basicProduct);

        logger.info(
          `Successfully synced product ${productId} to Lexoffice (basic data)`
        );
      } catch (basicError) {
        logger.error(
          `Failed to sync product ${productId} even with basic data:`,
          basicError
        );
        throw basicError;
      }
    }
  } catch (error) {
    logger.error(`Failed to sync product ${productId} to Lexoffice`, error);
    // Don't throw the error to prevent the event from failing
    // In production, you might want to implement retry logic or error reporting
  }
}

export const config: SubscriberConfig = {
  event: "product.created",
};
