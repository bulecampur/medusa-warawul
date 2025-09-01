import { Module } from "@medusajs/framework/utils";
import LexofficeService from "./service";

export const LEXOFFICE_MODULE = "lexoffice";

export default Module(LEXOFFICE_MODULE, {
  service: LexofficeService,
});

export * from "./service";