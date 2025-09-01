import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import ProductSyncService from "../../../../modules/product_sync/service"

export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  try {
    const productSyncService = req.scope.resolve("product_sync") as ProductSyncService
    const mappings = productSyncService.getAllMappings()
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>LexOffice Integration Dashboard</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f9fafb; }
            .container { max-width: 1200px; margin: 0 auto; }
            .header { background: white; padding: 24px; border-radius: 8px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            .title { font-size: 28px; font-weight: bold; color: #111827; margin: 0 0 8px 0; }
            .subtitle { color: #6b7280; margin: 0 0 16px 0; }
            .stats { display: flex; gap: 16px; align-items: center; }
            .stat-badge { padding: 8px 16px; background: #dcfce7; color: #166534; border-radius: 20px; font-size: 14px; font-weight: 500; }
            .table { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            .table-header { background: #f9fafb; padding: 16px; border-bottom: 1px solid #e5e7eb; font-weight: 600; display: grid; grid-template-columns: 1fr 1fr 2fr 1fr 1fr auto; gap: 16px; }
            .table-row { padding: 16px; border-bottom: 1px solid #f3f4f6; display: grid; grid-template-columns: 1fr 1fr 2fr 1fr 1fr auto; gap: 16px; align-items: center; }
            .table-row:last-child { border-bottom: none; }
            .monospace { font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace; font-size: 12px; }
            .copy-btn { padding: 4px 8px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 4px; font-size: 10px; cursor: pointer; }
            .copy-btn:hover { background: #e5e7eb; }
            .uuid-cell { display: flex; align-items: center; gap: 8px; }
            .uuid-input { padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 4px; background: #f9fafb; font-family: monospace; font-size: 11px; width: 200px; }
            .empty-state { text-align: center; padding: 48px; color: #6b7280; }
            .empty-state h3 { color: #374151; margin: 0 0 8px 0; }
            .actions { margin-top: 24px; display: flex; gap: 12px; }
            .btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; text-decoration: none; display: inline-block; text-align: center; }
            .btn-primary { background: #3b82f6; color: white; }
            .btn-secondary { background: #6b7280; color: white; }
            .btn-success { background: #10b981; color: white; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 class="title">🔗 LexOffice Integration Dashboard</h1>
                <p class="subtitle">Manage product synchronization with LexOffice accounting system</p>
                <div class="stats">
                    <div class="stat-badge">${mappings.length} variants synced</div>
                    <div style="font-size: 14px; color: #6b7280;">Last updated: ${new Date().toLocaleString()}</div>
                </div>
            </div>

            ${mappings.length === 0 ? `
                <div class="table">
                    <div class="empty-state">
                        <h3>No Synced Products Found</h3>
                        <p>Create or update products in your admin dashboard to see them here.</p>
                        <p style="font-size: 14px;">Products are automatically synced when created or updated.</p>
                    </div>
                </div>
            ` : `
                <div class="table">
                    <div class="table-header">
                        <div>Product ID</div>
                        <div>Variant ID</div>
                        <div>LexOffice UUID</div>
                        <div>SKU</div>
                        <div>Last Synced</div>
                        <div>Actions</div>
                    </div>
                    ${mappings.map(mapping => `
                        <div class="table-row">
                            <div class="monospace">${mapping.medusaProductId || 'N/A'}</div>
                            <div class="monospace">${mapping.medusaVariantId}</div>
                            <div class="uuid-cell">
                                <input class="uuid-input" value="${mapping.lexofficeVariantId}" readonly />
                                <button class="copy-btn" onclick="copyToClipboard('${mapping.lexofficeVariantId}')">Copy</button>
                            </div>
                            <div class="monospace">${mapping.sku || 'N/A'}</div>
                            <div style="font-size: 12px; color: #6b7280;">${new Date(mapping.lastSynced).toLocaleDateString()}</div>
                            <div>
                                <a href="/admin/products/${mapping.medusaProductId}" class="btn btn-primary" style="font-size: 11px; padding: 4px 8px;">View Product</a>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `}

            <div class="actions">
                <button onclick="updateUuids()" class="btn btn-success">Update All UUIDs in Database</button>
                <button onclick="window.location.reload()" class="btn btn-secondary">Refresh Data</button>
                <a href="/admin/products" class="btn btn-primary">Manage Products</a>
                <a href="/admin/lexoffice/sync" class="btn btn-secondary" target="_blank">View Raw API Data</a>
            </div>
        </div>

        <script>
            function copyToClipboard(text) {
                navigator.clipboard.writeText(text).then(() => {
                    // Simple feedback
                    const originalText = event.target.textContent;
                    event.target.textContent = 'Copied!';
                    setTimeout(() => {
                        event.target.textContent = originalText;
                    }, 1000);
                });
            }

            async function updateUuids() {
                const btn = event.target;
                const originalText = btn.textContent;
                btn.textContent = 'Updating...';
                btn.disabled = true;

                try {
                    const response = await fetch('/admin/lexoffice/update-uuids', {
                        method: 'POST'
                    });
                    
                    if (response.ok) {
                        btn.textContent = 'Updated!';
                        setTimeout(() => {
                            window.location.reload();
                        }, 1000);
                    } else {
                        btn.textContent = 'Failed';
                        setTimeout(() => {
                            btn.textContent = originalText;
                            btn.disabled = false;
                        }, 2000);
                    }
                } catch (error) {
                    btn.textContent = 'Error';
                    setTimeout(() => {
                        btn.textContent = originalText;
                        btn.disabled = false;
                    }, 2000);
                }
            }
        </script>
    </body>
    </html>
    `
    
    res.setHeader('Content-Type', 'text/html')
    res.send(html)
    
  } catch (error) {
    res.status(500).json({
      error: "Failed to load dashboard",
      details: error.message
    })
  }
}