import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { Modules } from "@medusajs/framework/utils";
import { useQueryGraphStep } from "@medusajs/medusa/core-flows";

type StepInput = {
  order: any; // Using any for now to avoid type conflicts
};

const trackOrderCreatedStep = createStep(
  "track_order_created_step",
  async ({ order }: StepInput, { container }) => {
    const analyticsModuleService = container.resolve(Modules.ANALYTICS);

    await analyticsModuleService.track({
      event: "order_created",
      actor_id: order.customer_id || order.email || "anonymous",
      properties: {
        order_id: order.id,
        total: order.total,
        items:
          order.items?.map((item: any) => ({
            variant_id: item.variant_id,
            product_id: item.product_id,
            quantity: item.quantity,
          })) || [],
        customer_id: order.customer_id,
      },
    });

    return new StepResponse("Order tracking completed");
  }
);

type WorkflowInput = {
  order_id: string;
};

export const trackOrderCreatedWorkflow = createWorkflow(
  "track_order_created_workflow",
  (input: WorkflowInput) => {
    const { order_id } = input;

    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: ["*", "customer.*", "items.*"],
      filters: {
        id: order_id,
      },
    });

    const result = trackOrderCreatedStep({
      order: orders[0],
    });

    return new WorkflowResponse(result);
  }
);
