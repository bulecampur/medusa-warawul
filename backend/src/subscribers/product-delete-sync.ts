import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ProductSyncService } from "../modules/product_sync";

export default async function productDeleteSyncHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const productId = data.id;
  const logger = container.resolve("logger");

  try {
    logger.info(`Product deletion sync event triggered for product ${productId}`);

    // Get the product sync service
    const productSyncService =
      container.resolve<ProductSyncService>("product_sync");

    // Delete the product and all its variants from Lexoffice
    await productSyncService.deleteProduct(productId);

    logger.info(`Successfully deleted product ${productId} from Lexoffice`);
  } catch (error) {
    logger.error(`Failed to delete product ${productId} from Lexoffice`, error);
    // Don't throw the error to prevent the event from failing
    // In production, you might want to implement retry logic or error reporting
  }
}

export const config: SubscriberConfig = {
  event: "product.deleted",
};