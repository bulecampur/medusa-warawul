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
    logger.info(`Loading LexOffice integration page for product ${productId}`)

    const productModuleService = req.scope.resolve("product")
    let productSyncService: ProductSyncService | null = null
    let serviceError: Error | null = null

    try {
      productSyncService = req.scope.resolve("product_sync") as ProductSyncService
      logger.info("ProductSyncService resolved successfully from container")
    } catch (err) {
      serviceError = err as Error
      logger.warn(`ProductSyncService not available in container: ${err.message}`)
      logger.info("Attempting to initialize ProductSyncService manually...")

      try {
        // Initialize service manually if not registered
        productSyncService = new ProductSyncService({
          logger,
          productModuleService
        })
        logger.info("ProductSyncService initialized manually")
      } catch (initError) {
        logger.error(`Failed to initialize ProductSyncService manually: ${initError.message}`)
        throw new Error(`ProductSyncService initialization failed: ${initError.message}`)
      }
    }

    if (!productSyncService) {
      throw new Error("Failed to initialize ProductSyncService")
    }

    // Get the product with variants
    const product = await productModuleService.retrieveProduct(productId, {
      relations: ["variants"]
    })

    if (!product) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Product Not Found</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; background: #f9fafb; }
            .error { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; text-align: center; }
            h1 { color: #ef4444; margin: 0 0 16px 0; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>❌ Product Not Found</h1>
            <p>Product with ID "${productId}" could not be found.</p>
            <a href="/app/lexoffice">← Back to Dashboard</a>
          </div>
        </body>
        </html>
      `)
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
        lexoffice_uuid: variant.metadata?.lexoffice_uuid || mapping?.lexofficeVariantId || null,
        last_synced: mapping?.lastSynced || null,
        is_synced: !!(variant.metadata?.lexoffice_uuid || mapping?.lexofficeVariantId)
      }
    }) || []

    // Generate HTML response
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>LexOffice Integration - ${product.title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            * { box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f9fafb; }
            .container { max-width: 1200px; margin: 0 auto; }
            .header { background: white; padding: 32px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
            .title { font-size: 28px; font-weight: bold; color: #111827; margin: 0 0 8px 0; }
            .subtitle { color: #6b7280; margin: 0 0 20px 0; font-size: 14px; }
            .back-link { display: inline-flex; align-items: center; gap: 8px; color: #3b82f6; text-decoration: none; padding: 8px 16px; border-radius: 8px; transition: all 0.2s; }
            .back-link:hover { background: #eff6ff; }
            .stats { display: flex; gap: 16px; margin-top: 20px; flex-wrap: wrap; }
            .stat { background: #f3f4f6; padding: 16px 24px; border-radius: 8px; }
            .stat-label { font-size: 12px; color: #6b7280; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; }
            .stat-value { font-size: 24px; font-weight: bold; color: #111827; margin: 0; }
            .table { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
            .table-header { background: #f9fafb; padding: 20px; border-bottom: 2px solid #e5e7eb; font-weight: 700; display: grid; grid-template-columns: 2fr 1.5fr 2.5fr 1fr auto; gap: 20px; color: #374151; }
            .table-row { padding: 20px; border-bottom: 1px solid #f3f4f6; display: grid; grid-template-columns: 2fr 1.5fr 2.5fr 1fr auto; gap: 20px; align-items: center; transition: background-color 0.2s; }
            .table-row:hover { background: #f9fafb; }
            .table-row:last-child { border-bottom: none; }
            .monospace { font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace; font-size: 12px; color: #374151; }
            .badge { padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; display: inline-block; }
            .badge-success { background: #dcfce7; color: #166534; }
            .badge-warning { background: #fef3c7; color: #92400e; }
            .uuid-cell { display: flex; align-items: center; gap: 12px; }
            .uuid-input { padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px; background: #f9fafb; font-family: monospace; font-size: 12px; flex: 1; color: #374151; }
            .copy-btn { padding: 6px 12px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 6px; font-size: 11px; cursor: pointer; transition: all 0.2s; color: #374151; font-weight: 500; white-space: nowrap; }
            .copy-btn:hover { background: #e5e7eb; border-color: #9ca3af; }
            .btn { padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; }
            .btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
            .btn-primary { background: #3b82f6; color: white; }
            .btn-primary:hover { background: #2563eb; }
            .btn-success { background: #10b981; color: white; }
            .btn-success:hover { background: #059669; }
            .actions { display: flex; gap: 12px; margin-top: 24px; flex-wrap: wrap; }
            .empty-state { text-align: center; padding: 60px 20px; color: #6b7280; }
            .no-uuid { color: #9ca3af; font-size: 12px; font-style: italic; }
            @media (max-width: 768px) {
                .table-header, .table-row { grid-template-columns: 1fr; gap: 8px; }
                .stats { flex-direction: column; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <a href="/app/lexoffice" class="back-link">← Back to Dashboard</a>
                <h1 class="title">🔗 ${product.title}</h1>
                <p class="subtitle">LexOffice Integration Status</p>

                <div class="stats">
                    <div class="stat">
                        <p class="stat-label">Total Variants</p>
                        <p class="stat-value">${variantsWithUuids.length}</p>
                    </div>
                    <div class="stat">
                        <p class="stat-label">Synced to LexOffice</p>
                        <p class="stat-value">${variantsWithUuids.filter(v => v.is_synced).length}</p>
                    </div>
                    <div class="stat">
                        <p class="stat-label">Not Synced</p>
                        <p class="stat-value">${variantsWithUuids.filter(v => !v.is_synced).length}</p>
                    </div>
                </div>
            </div>

            ${variantsWithUuids.length === 0 ? `
                <div class="table">
                    <div class="empty-state">
                        <h3>📦 No Variants Found</h3>
                        <p>This product has no variants to sync.</p>
                    </div>
                </div>
            ` : `
                <div class="table">
                    <div class="table-header">
                        <div>Variant Title</div>
                        <div>SKU</div>
                        <div>LexOffice UUID</div>
                        <div>Status</div>
                        <div>Last Synced</div>
                    </div>
                    ${variantsWithUuids.map(variant => `
                        <div class="table-row">
                            <div><strong>${variant.title || 'Untitled Variant'}</strong></div>
                            <div class="monospace">${variant.sku || 'N/A'}</div>
                            <div class="uuid-cell">
                                ${variant.lexoffice_uuid ? `
                                    <input class="uuid-input" value="${variant.lexoffice_uuid}" readonly />
                                    <button class="copy-btn" onclick="copyToClipboard('${variant.lexoffice_uuid}', this)">📋 Copy</button>
                                ` : `
                                    <span class="no-uuid">Not synced yet</span>
                                `}
                            </div>
                            <div>
                                ${variant.is_synced ?
                                    '<span class="badge badge-success">✅ Synced</span>' :
                                    '<span class="badge badge-warning">⏳ Pending</span>'
                                }
                            </div>
                            <div style="font-size: 12px; color: #6b7280;">
                                ${variant.last_synced ? new Date(variant.last_synced).toLocaleDateString() : 'Never'}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `}

            <div class="actions">
                <button onclick="syncProduct()" class="btn btn-success">
                    🔄 Sync Product to LexOffice
                </button>
                <a href="/app/lexoffice" class="btn btn-primary">
                    📊 View All Products
                </a>
            </div>
        </div>

        <script>
            function copyToClipboard(text, button) {
                navigator.clipboard.writeText(text).then(() => {
                    const originalText = button.textContent;
                    button.textContent = '✅ Copied!';
                    button.style.background = '#dcfce7';
                    button.style.color = '#166534';

                    setTimeout(() => {
                        button.textContent = originalText;
                        button.style.background = '#f3f4f6';
                        button.style.color = '#374151';
                    }, 2000);
                }).catch(() => {
                    button.textContent = '❌ Failed';
                    setTimeout(() => {
                        button.textContent = '📋 Copy';
                    }, 2000);
                });
            }

            async function syncProduct() {
                const btn = event.target;
                const originalText = btn.textContent;

                btn.textContent = '⏳ Syncing...';
                btn.disabled = true;
                btn.style.cursor = 'not-allowed';
                btn.style.opacity = '0.6';

                try {
                    const response = await fetch('/app/products/${productId}/lexoffice', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });

                    if (response.ok) {
                        const result = await response.json();
                        btn.textContent = '✅ Synced! Refreshing...';
                        btn.style.background = '#10b981';

                        setTimeout(() => {
                            window.location.reload();
                        }, 1500);
                    } else {
                        const error = await response.json();
                        btn.textContent = \`❌ \${error.error || 'Sync failed'}\`;
                        btn.style.background = '#ef4444';

                        setTimeout(() => {
                            btn.textContent = originalText;
                            btn.disabled = false;
                            btn.style.cursor = 'pointer';
                            btn.style.opacity = '1';
                            btn.style.background = '#10b981';
                        }, 3000);
                    }
                } catch (error) {
                    btn.textContent = '❌ Network Error';
                    btn.style.background = '#ef4444';

                    setTimeout(() => {
                        btn.textContent = originalText;
                        btn.disabled = false;
                        btn.style.cursor = 'pointer';
                        btn.style.opacity = '1';
                        btn.style.background = '#10b981';
                    }, 3000);
                }
            }
        </script>
    </body>
    </html>
    `

    res.setHeader('Content-Type', 'text/html')
    res.send(html)

  } catch (error) {
    logger.error(`Failed to get LexOffice data for product ${productId}:`, error)
    res.status(500).send(`
      <html>
        <body style="font-family: monospace; padding: 20px;">
          <h1>❌ Error Loading Product</h1>
          <p><strong>Error:</strong> ${error.message}</p>
          <p><strong>Stack:</strong></p>
          <pre style="background: #f3f4f6; padding: 16px; border-radius: 8px; overflow-x: auto;">${error.stack}</pre>
          <a href="/app/lexoffice" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">← Back to Dashboard</a>
        </body>
      </html>
    `)
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
    let productSyncService: ProductSyncService | null = null

    try {
      productSyncService = req.scope.resolve("product_sync") as ProductSyncService
    } catch (serviceError) {
      logger.warn("ProductSyncService not available, initializing manually")
      productSyncService = new ProductSyncService({
        logger,
        productModuleService
      })
    }

    if (!productSyncService) {
      throw new Error("Failed to initialize ProductSyncService")
    }

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
      success: true,
      message: `Product "${product.title}" has been synced to LexOffice`,
      product_id: productId,
      product_title: product.title
    })

  } catch (error) {
    logger.error(`Failed to sync product ${productId} to LexOffice:`, error)
    res.status(500).json({
      success: false,
      error: "Failed to sync product to LexOffice",
      details: error.message
    })
  }
}
