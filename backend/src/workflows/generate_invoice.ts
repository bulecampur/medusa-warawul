import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { useQueryGraphStep } from "@medusajs/medusa/core-flows";
import { generateInvoiceStep } from "./steps/generate_invoice";

type WorkflowInput = {
  orderId: string;
};

export const generateInvoiceWorkflow = createWorkflow(
  "generate_invoice",
  (input: WorkflowInput) => {
    const { orderId } = input;

    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "currency_code",
        "total",
        "subtotal",
        "discount_total",
        "shipping_total",
        "tax_total",
        "item_subtotal",
        "item_total",
        "item_tax_total",
        "items.*",
        "items.variant.*",
        "items.variant.metadata",
        "shipping_address.*",
        "billing_address.*",
        "shipping_methods.*",
        "customer.*",
      ],
      filters: {
        id: orderId,
      },
    });

    if (!orders[0]) {
      throw new Error(`Order with ID ${orderId} not found`);
    }

    const result = generateInvoiceStep({
      order: orders[0] as any,
    });

    return new WorkflowResponse(result);
  }
);
