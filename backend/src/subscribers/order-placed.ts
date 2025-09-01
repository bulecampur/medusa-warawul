import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { generateInvoiceWorkflow } from "../workflows/generate_invoice";
import { sendOrderConfirmationWorkflow } from "../workflows/send_order_confirmation";
import { trackOrderCreatedWorkflow } from "../workflows/track_order_created";

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger");

  try {
    logger.info(`Processing order placed event for order: ${data.id}`);

    // Generate invoice first
    let invoiceData;
    try {
      logger.info(`Generating invoice for order ${data.id}`);
      const invoiceResult = await generateInvoiceWorkflow(container).run({
        input: {
          orderId: data.id,
        },
      });
      invoiceData = invoiceResult.result;
      logger.info(
        `Invoice generated successfully for order ${data.id}: ${JSON.stringify(invoiceData)}`
      );
    } catch (error) {
      logger.error("Failed to generate invoice for order", error);
      // Don't block email sending if invoice generation fails
    }

    // Send order confirmation email using workflow
    try {
      logger.info(`Sending order confirmation email for order ${data.id}`);
      
      await sendOrderConfirmationWorkflow(container).run({
        input: {
          id: data.id,
          invoiceData: invoiceData,
        },
      });

      logger.info(
        `✅ Order confirmation email sent successfully for order ${data.id}`
      );
    } catch (error) {
      logger.error("Failed to send order confirmation email:", error);
    }

    // Track order creation analytics
    try {
      await trackOrderCreatedWorkflow(container).run({
        input: {
          order_id: data.id,
        },
      });
      logger.info(`Order analytics tracked for order ${data.id}`);
    } catch (error) {
      logger.error("Failed to track order analytics:", error);
      // Don't fail the whole process if analytics fail
    }
  } catch (error) {
    logger.error("Failed to process order placed event:", error);
    logger.error("Error stack:", error.stack);
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
};
