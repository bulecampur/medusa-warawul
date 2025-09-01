import { Module } from "@medusajs/framework/utils";
import ProductSyncService from "./service";

export const PRODUCT_SYNC_MODULE = "product_sync";

export default Module(PRODUCT_SYNC_MODULE, {
  service: ProductSyncService,
});

export * from "./service";
