import { Module } from "@medusajs/framework/utils";
import InvoiceGeneratorService from "./service";

export const INVOICE_GENERATOR_MODULE = "invoice_generator";

export default Module(INVOICE_GENERATOR_MODULE, {
  service: InvoiceGeneratorService,
});

export * from "./service";