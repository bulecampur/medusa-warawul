import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import ProductSyncService from "../../../modules/product_sync/service"

export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  try {
    const productSyncService = req.scope.resolve("product_sync") as ProductSyncService
    const mappings = productSyncService.getAllMappings()
    
    res.json({
      status: "✅ LexOffice integration is working!",
      total_synced_variants: mappings.length,
      sample_data: mappings.slice(0, 3).map(m => ({
        variant_id: m.medusaVariantId,
        lexoffice_uuid: m.lexofficeVariantId,
        sku: m.sku,
        last_synced: m.lastSynced
      })),
      access_instructions: {
        admin_url: "/admin",
        direct_api: "/admin/lexoffice/sync",
        debug_url: "/admin/debug/lexoffice-status"
      }
    })
  } catch (error) {
    res.status(500).json({
      status: "❌ Error accessing LexOffice service",
      error: error.message
    })
  }
}