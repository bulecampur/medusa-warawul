import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Logger } from "@medusajs/framework/types"
import ProductSyncService from "../../../../modules/product_sync/service"

export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const logger = req.scope.resolve("logger") as Logger
  
  try {
    const productSyncService = req.scope.resolve("product_sync") as ProductSyncService
    const mappings = productSyncService.getAllMappings()

    res.json({
      mappings: mappings.map(mapping => ({
        medusa_product_id: mapping.medusaProductId,
        medusa_variant_id: mapping.medusaVariantId,
        lexoffice_uuid: mapping.lexofficeVariantId,
        sku: mapping.sku,
        last_synced: mapping.lastSynced,
        last_price: mapping.lastPrice
      })),
      total: mappings.length
    })
  } catch (error) {
    logger.error("Failed to get LexOffice mappings:", error)
    res.status(500).json({ 
      error: "Failed to retrieve LexOffice sync mappings",
      details: error.message
    })
  }
}

export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const logger = req.scope.resolve("logger") as Logger
  const { product_id } = req.body as { product_id?: string }

  if (!product_id) {
    return res.status(400).json({
      error: "product_id is required"
    })
  }

  try {
    const productModuleService = req.scope.resolve("product")
    const productSyncService = req.scope.resolve("product_sync") as ProductSyncService

    // Get the product with variants
    const product = await productModuleService.retrieveProduct(product_id, {
      relations: ["variants"]
    })

    if (!product) {
      return res.status(404).json({
        error: `Product with id ${product_id} not found`
      })
    }

    // Sync the product to LexOffice
    await productSyncService.syncProduct(product)

    res.json({
      message: `Product ${product_id} has been synced to LexOffice`,
      product_id: product_id
    })
  } catch (error) {
    logger.error(`Failed to sync product ${product_id} to LexOffice:`, error)
    res.status(500).json({
      error: "Failed to sync product to LexOffice",
      details: error.message
    })
  }
}