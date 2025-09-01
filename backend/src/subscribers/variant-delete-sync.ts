import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import ProductSyncService from "../modules/product_sync/service";

export default async function variantDeleteSyncHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const variantId = data.id;
  const logger = container.resolve("logger");

  try {
    logger.info(`Variant deletion sync event triggered for variant ${variantId}`);

    // Get the product sync service
    const productSyncService =
      container.resolve<ProductSyncService>("product_sync");

    // Delete the specific variant from Lexoffice
    await productSyncService.deleteProductVariant(variantId);

    logger.info(`Successfully deleted variant ${variantId} from Lexoffice`);
  } catch (error) {
    logger.error(`Failed to delete variant ${variantId} from Lexoffice`, error);
    // Don't throw the error to prevent the event from failing
    // In production, you might want to implement retry logic or error reporting
  }
}

export const config: SubscriberConfig = {
  event: "product-variant.deleted",
};