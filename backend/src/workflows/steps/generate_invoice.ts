import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import InvoiceGeneratorService from "../../modules/invoice_generator/service";

type GenerateInvoiceStepInput = {
  order: any;
};

export const generateInvoiceStep = createStep(
  "generate_invoice_step",
  async ({ order }: GenerateInvoiceStepInput, { container }) => {
    const invoiceGenerator =
      container.resolve<InvoiceGeneratorService>("invoice_generator");

    const result = await invoiceGenerator.generateInvoice(order);

    return new StepResponse(result, {
      invoiceId: result.invoiceId,
      minioKey: result.minioKey,
    });
  },
  async (compensationData, { container }) => {
    // Compensation step - cleanup if needed
    const logger = container.resolve("logger");
    if (compensationData) {
      logger.warn(
        `Compensation: Invoice ${compensationData.invoiceId} generation failed, cleanup may be needed for ${compensationData.minioKey}`
      );
    }
  }
);
