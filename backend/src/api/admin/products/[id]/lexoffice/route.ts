import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Logger } from "@medusajs/framework/types"
import ProductSyncService from "../../../../../modules/product_sync/service"

export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const logger = req.scope.resolve("logger") as Logger
  const productId = req.params.id

  try {
    const productModuleService = req.scope.resolve("product")
    const productSyncService = req.scope.resolve("product_sync") as ProductSyncService
    
    // Get the product with variants
    const product = await productModuleService.retrieveProduct(productId, {
      relations: ["variants"]
    })

    if (!product) {
      return res.status(404).json({
        error: `Product with id ${productId} not found`
      })
    }

    // Get sync mappings
    const mappings = productSyncService.getAllMappings()
    
    // Enrich variants with LexOffice UUIDs
    const variantsWithUuids = product.variants?.map((variant: any) => {
      const mapping = mappings.find(m => m.medusaVariantId === variant.id)
      return {
        id: variant.id,
        title: variant.title,
        sku: variant.sku,
        lexoffice_uuid: variant.metadata?.lexoffice_uuid || variant.lexoffice_uuid || mapping?.lexofficeVariantId || null,
        last_synced: mapping?.lastSynced || null
      }
    }) || []

    res.json({
      product: {
        id: product.id,
        title: product.title,
        variants: variantsWithUuids
      },
      sync_status: {
        total_variants: variantsWithUuids.length,
        synced_variants: variantsWithUuids.filter(v => v.lexoffice_uuid).length
      }
    })

  } catch (error) {
    logger.error(`Failed to get LexOffice data for product ${productId}:`, error)
    res.status(500).json({
      error: "Failed to retrieve LexOffice data",
      details: error.message
    })
  }
}

export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const logger = req.scope.resolve("logger") as Logger
  const productId = req.params.id

  try {
    const productModuleService = req.scope.resolve("product")
    const productSyncService = req.scope.resolve("product_sync") as ProductSyncService

    // Get the product with variants
    const product = await productModuleService.retrieveProduct(productId, {
      relations: ["variants"]
    })

    if (!product) {
      return res.status(404).json({
        error: `Product with id ${productId} not found`
      })
    }

    // Sync the product to LexOffice
    await productSyncService.syncProduct(product)

    res.json({
      message: `Product ${productId} has been synced to LexOffice`,
      product_id: productId
    })

  } catch (error) {
    logger.error(`Failed to sync product ${productId} to LexOffice:`, error)
    res.status(500).json({
      error: "Failed to sync product to LexOffice",
      details: error.message
    })
  }
}