export async function GET() {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      env: {
        backend_url: process.env.MEDUSA_BACKEND_URL ? 'set' : 'missing',
        base_url: process.env.NEXT_PUBLIC_BASE_URL ? 'set' : 'missing',
      }
    }
    return Response.json(health, { status: 200 })
  } catch (error) {
    return Response.json({ status: 'error', error: String(error) }, { status: 500 })
  }
}