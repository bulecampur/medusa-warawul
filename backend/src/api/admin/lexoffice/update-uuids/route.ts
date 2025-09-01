import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Logger } from "@medusajs/framework/types"
import ProductSyncService from "../../../../modules/product_sync/service"

export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const logger = req.scope.resolve("logger") as Logger
  
  try {
    const productModuleService = req.scope.resolve("product")
    const productSyncService = req.scope.resolve("product_sync") as ProductSyncService
    
    // Get all mappings from the sync service
    const mappings = productSyncService.getAllMappings()
    
    let updatedCount = 0
    
    // Update each variant with its LexOffice UUID using Medusa's safe API
    for (const mapping of mappings) {
      try {
        // Use the safe update method that handles the database properly
        await productModuleService.upsertProductVariants([{
          id: mapping.medusaVariantId,
          metadata: {
            lexoffice_uuid: mapping.lexofficeVariantId,
          }
        }])
        updatedCount++
        logger.info(`Updated variant ${mapping.medusaVariantId} metadata with UUID ${mapping.lexofficeVariantId}`)
      } catch (variantError) {
        logger.error(`Failed to update variant ${mapping.medusaVariantId}:`, variantError)
      }
    }
    
    res.json({
      message: `Updated ${updatedCount} variants with LexOffice UUIDs`,
      total_mappings: mappings.length,
      updated_count: updatedCount
    })
    
  } catch (error) {
    logger.error("Failed to update variants with LexOffice UUIDs:", error)
    res.status(500).json({
      error: "Failed to update variants with LexOffice UUIDs",
      details: error.message
    })
  }
}