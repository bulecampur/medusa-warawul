import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import ProductSyncService from "../../../modules/product_sync/service"

export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  try {
    const productModuleService = req.scope.resolve("product")
    const productSyncService = req.scope.resolve("product_sync") as ProductSyncService
    
    // Get all mappings from the sync service
    const mappings = productSyncService.getAllMappings()
    
    let updatedCount = 0
    const errors: string[] = []
    
    // Update each variant with its LexOffice UUID
    for (const mapping of mappings) {
      try {
        await productModuleService.upsertProductVariants([{
          id: mapping.medusaVariantId,
          metadata: {
            lexoffice_uuid: mapping.lexofficeVariantId,
          }
        }])
        updatedCount++
      } catch (variantError) {
        errors.push(`Failed to update variant ${mapping.medusaVariantId}: ${variantError instanceof Error ? variantError.message : String(variantError)}`)
      }
    }
    
    res.json({
      success: true,
      message: `Updated ${updatedCount} variants with LexOffice UUIDs`,
      total_mappings: mappings.length,
      updated_count: updatedCount,
      errors: errors
    })
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to update variants with LexOffice UUIDs",
      details: error.message
    })
  }
}

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
            .container { max-width: 1400px; margin: 0 auto; }
            .header { background: white; padding: 32px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
            .title { font-size: 32px; font-weight: bold; color: #111827; margin: 0 0 8px 0; }
            .subtitle { color: #6b7280; margin: 0 0 20px 0; font-size: 16px; }
            .stats { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
            .stat-badge { padding: 10px 20px; background: #dcfce7; color: #166534; border-radius: 24px; font-size: 14px; font-weight: 600; }
            .timestamp { font-size: 14px; color: #6b7280; padding: 8px 16px; background: #f3f4f6; border-radius: 20px; }
            .table { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); margin-bottom: 24px; }
            .table-header { background: #f9fafb; padding: 20px; border-bottom: 2px solid #e5e7eb; font-weight: 700; display: grid; grid-template-columns: 1.5fr 1.5fr 2.5fr 1fr 1.2fr auto; gap: 20px; color: #374151; }
            .table-row { padding: 20px; border-bottom: 1px solid #f3f4f6; display: grid; grid-template-columns: 1.5fr 1.5fr 2.5fr 1fr 1.2fr auto; gap: 20px; align-items: center; transition: background-color 0.2s; }
            .table-row:hover { background: #f9fafb; }
            .table-row:last-child { border-bottom: none; }
            .monospace { font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace; font-size: 12px; color: #374151; }
            .copy-btn { padding: 6px 12px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 6px; font-size: 11px; cursor: pointer; transition: all 0.2s; color: #374151; font-weight: 500; }
            .copy-btn:hover { background: #e5e7eb; border-color: #9ca3af; }
            .copy-btn:active { background: #d1d5db; }
            .uuid-cell { display: flex; align-items: center; gap: 12px; }
            .uuid-input { padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px; background: #f9fafb; font-family: monospace; font-size: 12px; width: 220px; color: #374151; }
            .empty-state { text-align: center; padding: 60px 20px; color: #6b7280; }
            .empty-state h3 { color: #374151; margin: 0 0 12px 0; font-size: 20px; }
            .empty-state p { margin: 8px 0; }
            .actions { display: flex; gap: 16px; flex-wrap: wrap; }
            .btn { padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s; }
            .btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
            .btn-primary { background: #3b82f6; color: white; }
            .btn-primary:hover { background: #2563eb; }
            .btn-secondary { background: #6b7280; color: white; }
            .btn-secondary:hover { background: #4b5563; }
            .btn-success { background: #10b981; color: white; }
            .btn-success:hover { background: #059669; }
            .product-link { color: #3b82f6; text-decoration: none; font-size: 11px; padding: 4px 8px; border: 1px solid #3b82f6; border-radius: 4px; transition: all 0.2s; }
            .product-link:hover { background: #3b82f6; color: white; }
            .info-section { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 24px; margin-top: 24px; }
            .info-title { color: #0369a1; font-size: 18px; font-weight: 700; margin: 0 0 12px 0; }
            .info-list { margin: 0; padding-left: 20px; color: #0369a1; }
            .info-list li { margin: 4px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 class="title">🔗 LexOffice Integration Dashboard</h1>
                <p class="subtitle">Manage and monitor product synchronization with your LexOffice accounting system</p>
                <div class="stats">
                    <div class="stat-badge">${mappings.length} variants synced</div>
                    <div class="timestamp">Last updated: ${new Date().toLocaleString()}</div>
                </div>
            </div>

            ${mappings.length === 0 ? `
                <div class="table">
                    <div class="empty-state">
                        <h3>🎯 No Synced Products Found</h3>
                        <p>Create or update products in your admin dashboard to see them appear here.</p>
                        <p style="font-size: 14px; font-weight: 500;">Products are automatically synced to LexOffice when created or updated.</p>
                        <div style="margin-top: 20px;">
                            <a href="/admin/products" class="btn btn-primary">📦 Go to Products</a>
                        </div>
                    </div>
                </div>
            ` : `
                <div class="table">
                    <div class="table-header">
                        <div>📦 Product ID</div>
                        <div>🏷️ Variant ID</div>
                        <div>🔗 LexOffice UUID</div>
                        <div>📋 SKU</div>
                        <div>📅 Last Synced</div>
                        <div>⚡ Actions</div>
                    </div>
                    ${mappings.map(mapping => `
                        <div class="table-row">
                            <div class="monospace">${mapping.medusaProductId || 'N/A'}</div>
                            <div class="monospace">${mapping.medusaVariantId}</div>
                            <div class="uuid-cell">
                                <input class="uuid-input" value="${mapping.lexofficeVariantId}" readonly />
                                <button class="copy-btn" onclick="copyToClipboard('${mapping.lexofficeVariantId}', this)">📋 Copy</button>
                            </div>
                            <div class="monospace">${mapping.sku || 'N/A'}</div>
                            <div style="font-size: 12px; color: #6b7280;">${new Date(mapping.lastSynced).toLocaleDateString()}</div>
                            <div>
                                ${mapping.medusaProductId && mapping.medusaProductId !== 'N/A' ? 
                                    `<a href="/admin/products/${mapping.medusaProductId}" class="product-link" target="_blank">View Product</a>` : 
                                    '<span style="color: #9ca3af; font-size: 11px;">No product link</span>'
                                }
                            </div>
                        </div>
                    `).join('')}
                </div>
            `}

            <div class="actions">
                <button onclick="updateUuids()" class="btn btn-success">💾 Update All UUIDs in Database</button>
                <button onclick="window.location.reload()" class="btn btn-secondary">🔄 Refresh Data</button>
                <a href="/admin/products" class="btn btn-primary">📦 Manage Products</a>
                <a href="/admin/lexoffice/sync" class="btn btn-secondary" target="_blank">🔍 View Raw API</a>
                <button onclick="toggleDebug()" class="btn btn-secondary">🐛 Debug Panel</button>
            </div>
            
            <!-- Debug Panel -->
            <div id="debug-panel" style="display: none; margin-top: 24px; background: #1f2937; color: #f9fafb; padding: 20px; border-radius: 8px; font-family: monospace; font-size: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 style="margin: 0; color: #60a5fa;">🐛 Debug Console</h3>
                    <button onclick="clearDebug()" style="padding: 4px 8px; background: #374151; color: white; border: none; border-radius: 4px; cursor: pointer;">Clear</button>
                </div>
                <div id="debug-output" style="background: #111827; padding: 12px; border-radius: 4px; max-height: 300px; overflow-y: auto;">
                    <div style="color: #10b981;">Debug panel ready. Click buttons above to see API calls...</div>
                </div>
            </div>

            <div class="info-section">
                <h3 class="info-title">ℹ️ How LexOffice Integration Works</h3>
                <ul class="info-list">
                    <li><strong>Automatic Sync:</strong> Products are synced to LexOffice when created or updated in your admin</li>
                    <li><strong>Unique UUIDs:</strong> Each product variant gets a unique identifier in LexOffice</li>
                    <li><strong>Real-time Updates:</strong> Changes in Medusa are reflected in your accounting system</li>
                    <li><strong>Easy Management:</strong> Use this dashboard to monitor and manage all synced products</li>
                    <li><strong>Copy UUIDs:</strong> Click any "Copy" button to copy UUIDs for external use</li>
                </ul>
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

            async function updateUuids() {
                const btn = event.target;
                const originalText = btn.textContent;
                const originalBg = btn.style.background || '#10b981';
                
                btn.textContent = '⏳ Updating UUIDs...';
                btn.disabled = true;
                btn.style.background = '#9ca3af';
                btn.style.cursor = 'not-allowed';

                try {
                    console.log('Attempting to update UUIDs...');
                    debugLog('Starting UUID update process...', 'info');
                    
                    // Try the update endpoint (same route, POST method)
                    const response = await fetch('/app/lexoffice', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        }
                    });
                    
                    console.log('Response status:', response.status);
                    debugLog(\`API Response: \${response.status} \${response.statusText}\`, response.ok ? 'success' : 'warning');
                    
                    if (response.ok) {
                        try {
                            const result = await response.json();
                            console.log('Update result:', result);
                            debugLog(\`Update successful: \${result.message || 'UUIDs updated'}\`, 'success');
                            
                            if (result.errors && result.errors.length > 0) {
                                result.errors.forEach(error => debugLog(error, 'warning'));
                            }
                            
                            btn.textContent = '✅ Updated! Refreshing...';
                            btn.style.background = '#10b981';
                            
                            // Show success message
                            if (result.updated_count !== undefined) {
                                btn.textContent = \`✅ Updated \${result.updated_count} variants!\`;
                                debugLog(\`Successfully updated \${result.updated_count}/\${result.total_mappings} variants\`, 'success');
                            }
                            
                            setTimeout(() => {
                                window.location.reload();
                            }, 2000);
                        } catch (jsonError) {
                            console.log('Response was OK but not JSON, treating as success');
                            debugLog('Response was OK but not JSON, treating as success', 'warning');
                            btn.textContent = '✅ Updated! Refreshing...';
                            btn.style.background = '#10b981';
                            setTimeout(() => {
                                window.location.reload();
                            }, 2000);
                        }
                    } else {
                        console.log('Response not OK:', response.status);
                        debugLog(\`Request failed: \${response.status} \${response.statusText}\`, 'error');
                        let errorMsg = 'Update failed';
                        
                        try {
                            const errorData = await response.json();
                            errorMsg = errorData.error || errorMsg;
                            debugLog(\`Error details: \${errorMsg}\`, 'error');
                        } catch (e) {
                            const errorText = await response.text();
                            if (errorText.includes('Unauthorized')) {
                                errorMsg = 'Authentication required';
                            }
                            debugLog(\`Raw error response: \${errorText.substring(0, 100)}...\`, 'error');
                        }
                        
                        btn.textContent = \`❌ \${errorMsg}\`;
                        btn.style.background = '#ef4444';
                        
                        setTimeout(() => {
                            btn.textContent = originalText;
                            btn.disabled = false;
                            btn.style.background = originalBg;
                            btn.style.cursor = 'pointer';
                        }, 4000);
                    }
                } catch (error) {
                    console.error('Network error:', error);
                    debugLog(\`Network error: \${error.message}\`, 'error');
                    btn.textContent = '❌ Network Error';
                    btn.style.background = '#ef4444';
                    
                    setTimeout(() => {
                        btn.textContent = originalText;
                        btn.disabled = false;
                        btn.style.background = originalBg;
                        btn.style.cursor = 'pointer';
                    }, 4000);
                }
            }
            
            // Add manual sync function
            async function syncProduct(productId) {
                if (!productId || productId === 'N/A') {
                    alert('No valid product ID available for sync');
                    return;
                }
                
                try {
                    console.log('Syncing product:', productId);
                    
                    const response = await fetch('/admin/lexoffice/sync', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ product_id: productId })
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        alert('Product synced successfully! Refreshing...');
                        window.location.reload();
                    } else {
                        const error = await response.json();
                        alert(\`Sync failed: \${error.error || 'Unknown error'}\`);
                    }
                } catch (error) {
                    alert(\`Network error: \${error.message}\`);
                }
            }

            // Debug panel functions
            function toggleDebug() {
                const panel = document.getElementById('debug-panel');
                const btn = event.target;
                
                if (panel.style.display === 'none') {
                    panel.style.display = 'block';
                    btn.textContent = '🐛 Hide Debug';
                    debugLog('Debug panel opened', 'info');
                } else {
                    panel.style.display = 'none';
                    btn.textContent = '🐛 Debug Panel';
                }
            }
            
            function clearDebug() {
                const output = document.getElementById('debug-output');
                output.innerHTML = '<div style="color: #10b981;">Debug panel cleared. Ready for new logs...</div>';
            }
            
            function debugLog(message, type = 'info') {
                const output = document.getElementById('debug-output');
                const timestamp = new Date().toLocaleTimeString();
                const colors = {
                    info: '#60a5fa',
                    success: '#10b981',
                    error: '#ef4444',
                    warning: '#f59e0b'
                };
                
                const logEntry = document.createElement('div');
                logEntry.innerHTML = \`<span style="color: #9ca3af;">[\${timestamp}]</span> <span style="color: \${colors[type]};">\${message}</span>\`;
                logEntry.style.marginBottom = '4px';
                
                output.appendChild(logEntry);
                output.scrollTop = output.scrollHeight;
            }

            // Auto-refresh every 30 seconds
            setInterval(() => {
                const refreshBtn = document.querySelector('[onclick="window.location.reload()"]');
                if (refreshBtn) {
                    const originalText = refreshBtn.textContent;
                    refreshBtn.textContent = '🔄 Auto-refreshing...';
                    setTimeout(() => {
                        window.location.reload();
                    }, 500);
                }
            }, 30000);
        </script>
    </body>
    </html>
    `
    
    res.setHeader('Content-Type', 'text/html')
    res.send(html)
    
  } catch (error) {
    res.status(500).send(`
      <html>
        <body style="font-family: monospace; padding: 20px;">
          <h1>❌ LexOffice Dashboard Error</h1>
          <p><strong>Error:</strong> ${error.message}</p>
          <p><strong>Details:</strong> Failed to load LexOffice integration dashboard</p>
          <button onclick="window.location.reload()">🔄 Retry</button>
        </body>
      </html>
    `)
  }
}