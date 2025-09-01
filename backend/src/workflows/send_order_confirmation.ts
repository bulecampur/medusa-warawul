import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { useQueryGraphStep } from "@medusajs/medusa/core-flows";
import { sendNotificationStep, NotificationInput } from "./steps/send-notification";

type WorkflowInput = {
  id: string;
  invoiceData?: {
    invoiceId: string;
    documentFileId: string;
    pdfUrl: string;
    r2Key: string;
  };
};

export const sendOrderConfirmationWorkflow = createWorkflow(
  "send_order_confirmation",
  ({ id, invoiceData }: WorkflowInput) => {
    // Fetch order with customer relation directly
    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "customer_id",
        "currency_code",
        "total",
        "subtotal",
        "discount_total",
        "shipping_total",
        "tax_total",
        "item_subtotal",
        "item_total",
        "item_tax_total",
        "summary.*",
        "items.*",
        "items.variant.*",
        "items.variant.product.*",
        "shipping_address.*",
        "billing_address.*",
        "shipping_methods.*",
        "customer.id",
        "customer.first_name",
        "customer.last_name",
        "customer.email",
      ],
      filters: {
        id,
      },
    });

    const order = orders[0];
    
    if (!order || !order.email) {
      throw new Error("Order not found or missing email address");
    }

    const notificationData: NotificationInput[] = [{
      to: order.email,
      channel: "email",
      template: "order.placed",
      data: {
        order: order,
        ...(invoiceData && { invoiceData: invoiceData })
      },
    }];

    const notification = sendNotificationStep(notificationData);

    return new WorkflowResponse(notification);
  }
);
