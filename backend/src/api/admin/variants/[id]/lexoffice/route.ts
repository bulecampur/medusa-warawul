import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Logger } from "@medusajs/framework/types"
import ProductSyncService from "../../../../../modules/product_sync/service"

export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const logger = req.scope.resolve("logger") as Logger
  const variantId = req.params.id

  try {
    const productModuleService = req.scope.resolve("product")
    const productSyncService = req.scope.resolve("product_sync") as ProductSyncService
    
    // Get the variant
    const variant = await productModuleService.retrieveProductVariant(variantId)

    if (!variant) {
      return res.status(404).json({
        error: `Variant with id ${variantId} not found`
      })
    }

    // Get sync mappings
    const mappings = productSyncService.getAllMappings()
    const mapping = mappings.find(m => m.medusaVariantId === variantId)
    
    res.json({
      variant: {
        id: variant.id,
        title: variant.title,
        sku: variant.sku,
        lexoffice_uuid: mapping?.lexofficeVariantId || variant.metadata?.lexoffice_uuid || null,
        last_synced: mapping?.lastSynced || null,
        is_synced: !!mapping?.lexofficeVariantId
      }
    })

  } catch (error) {
    logger.error(`Failed to get LexOffice data for variant ${variantId}:`, error)
    res.status(500).json({
      error: "Failed to retrieve LexOffice data",
      details: error.message
    })
  }
}