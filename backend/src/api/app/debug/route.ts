import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const logger = req.scope.resolve("logger")

  const diagnostics = {
    timestamp: new Date().toISOString(),
    services: {
      product_sync: { available: false, error: null as string | null },
      product: { available: false, error: null as string | null },
      lexoffice: { available: false, error: null as string | null },
      invoice_generator: { available: false, error: null as string | null },
    },
    environment: {
      LEXWARE_API_KEY: !!process.env.LEXWARE_API_KEY,
      S3_ENDPOINT: !!process.env.S3_ENDPOINT,
      S3_ACCESS_KEY_ID: !!process.env.S3_ACCESS_KEY_ID,
      RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    }
  }

  // Test product_sync service
  try {
    const productSyncService = req.scope.resolve("product_sync")
    diagnostics.services.product_sync.available = !!productSyncService
    logger.info("✅ product_sync service is available")
  } catch (error) {
    diagnostics.services.product_sync.error = error.message
    logger.error(`❌ product_sync service error: ${error.message}`)
  }

  // Test product service
  try {
    const productService = req.scope.resolve("product")
    diagnostics.services.product.available = !!productService
    logger.info("✅ product service is available")
  } catch (error) {
    diagnostics.services.product.error = error.message
    logger.error(`❌ product service error: ${error.message}`)
  }

  // Test lexoffice service
  try {
    const lexofficeService = req.scope.resolve("lexoffice")
    diagnostics.services.lexoffice.available = !!lexofficeService
    logger.info("✅ lexoffice service is available")
  } catch (error) {
    diagnostics.services.lexoffice.error = error.message
    logger.error(`❌ lexoffice service error: ${error.message}`)
  }

  // Test invoice_generator service
  try {
    const invoiceService = req.scope.resolve("invoice_generator")
    diagnostics.services.invoice_generator.available = !!invoiceService
    logger.info("✅ invoice_generator service is available")
  } catch (error) {
    diagnostics.services.invoice_generator.error = error.message
    logger.error(`❌ invoice_generator service error: ${error.message}`)
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Service Diagnostics</title>
  <style>
    body { font-family: monospace; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { color: #4ec9b0; }
    .section { background: #252526; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .service { padding: 12px; margin: 8px 0; border-radius: 4px; }
    .available { background: #1e3a1e; border-left: 4px solid #4ec9b0; }
    .unavailable { background: #3a1e1e; border-left: 4px solid #f48771; }
    .status { font-weight: bold; }
    .error { color: #f48771; font-size: 12px; margin-top: 8px; }
    .env { padding: 8px; background: #2d2d30; border-radius: 4px; margin: 4px 0; }
    .check { color: #4ec9b0; }
    .cross { color: #f48771; }
    pre { background: #2d2d30; padding: 16px; border-radius: 4px; overflow-x: auto; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔍 LexOffice Integration Diagnostics</h1>
    <p>Timestamp: ${diagnostics.timestamp}</p>

    <div class="section">
      <h2>📦 Services Status</h2>
      ${Object.entries(diagnostics.services).map(([name, status]) => `
        <div class="service ${status.available ? 'available' : 'unavailable'}">
          <div class="status">
            ${status.available ? '<span class="check">✅</span>' : '<span class="cross">❌</span>'}
            <strong>${name}</strong>
          </div>
          ${status.error ? `<div class="error">Error: ${status.error}</div>` : ''}
        </div>
      `).join('')}
    </div>

    <div class="section">
      <h2>🌍 Environment Variables</h2>
      ${Object.entries(diagnostics.environment).map(([name, value]) => `
        <div class="env">
          ${value ? '<span class="check">✅</span>' : '<span class="cross">❌</span>'}
          <strong>${name}</strong>: ${value ? 'Configured' : 'Missing'}
        </div>
      `).join('')}
    </div>

    <div class="section">
      <h2>📋 Raw Data</h2>
      <pre>${JSON.stringify(diagnostics, null, 2)}</pre>
    </div>

    <div style="margin-top: 20px;">
      <a href="/app/lexoffice" style="color: #4ec9b0; text-decoration: none;">← Back to Dashboard</a>
    </div>
  </div>
</body>
</html>
  `

  res.setHeader('Content-Type', 'text/html')
  res.send(html)
}
