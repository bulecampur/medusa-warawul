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
  const { product_id, sync_all } = req.body as { product_id?: string, sync_all?: boolean }

  try {
    const productModuleService = req.scope.resolve("product")
    const productSyncService = req.scope.resolve("product_sync") as ProductSyncService

    // If sync_all is true, sync all products
    if (sync_all) {
      logger.info("Starting sync of all products to LexOffice")

      // Get all products (without filters)
      const allProducts = await productModuleService.listProducts()

      if (!allProducts || allProducts.length === 0) {
        return res.json({
          message: "No products found to sync",
          synced_count: 0,
          total_products: 0
        })
      }

      logger.info(`Found ${allProducts.length} products to sync`)

      let successCount = 0
      let failedCount = 0
      const errors: string[] = []

      // Sync each product - retrieve with variants individually
      for (const productItem of allProducts) {
        try {
          logger.info(`Syncing product ${productItem.id} (${productItem.title})`)

          // Retrieve the full product with variants
          const product = await productModuleService.retrieveProduct(productItem.id, {
            relations: ["variants"]
          })

          await productSyncService.syncProduct(product)
          successCount++

          // Add a small delay to avoid rate limiting (2 seconds between products)
          if (allProducts.indexOf(productItem) < allProducts.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        } catch (syncError) {
          failedCount++
          const errorMsg = `Product ${productItem.id}: ${syncError.message}`
          errors.push(errorMsg)
          logger.error(`Failed to sync product ${productItem.id}:`, syncError)
          // Continue with other products
        }
      }

      logger.info(`Sync complete: ${successCount} succeeded, ${failedCount} failed`)

      return res.json({
        success: true,
        message: `Synced ${successCount} of ${allProducts.length} products to LexOffice`,
        synced_count: successCount,
        failed_count: failedCount,
        total_products: allProducts.length,
        errors: errors.length > 0 ? errors : undefined
      })
    }

    // Single product sync
    if (!product_id) {
      return res.status(400).json({
        error: "product_id is required when sync_all is not true"
      })
    }

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
      success: true,
      message: `Product "${product.title}" has been synced to LexOffice`,
      product_id: product_id
    })
  } catch (error) {
    logger.error(`Failed to sync products to LexOffice:`, error)
    res.status(500).json({
      success: false,
      error: "Failed to sync to LexOffice",
      details: error.message
    })
  }
}