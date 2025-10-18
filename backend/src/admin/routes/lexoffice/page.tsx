import React, { useEffect, useState } from 'react'

interface SyncMapping {
  medusa_product_id: string
  medusa_variant_id: string  
  lexoffice_uuid: string
  sku: string
  last_synced: string
}

interface SyncData {
  mappings: SyncMapping[]
  total: number
}

const LexOfficeDashboard: React.FC = () => {
  const [data, setData] = useState<SyncData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncingAll, setSyncingAll] = useState(false)
  const [syncProgress, setSyncProgress] = useState('')

  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/lexoffice/sync', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      if (!response.ok) {
        throw new Error(`Failed to fetch sync data: ${response.status} ${response.statusText}`)
      }
      const result = await response.json()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const updateUuids = async () => {
    try {
      setSyncing(true)
      const response = await fetch('/api/admin/lexoffice/update-uuids', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      if (!response.ok) {
        throw new Error('Failed to update UUIDs')
      }

      // Refresh data
      await fetchData()

    } catch (err) {
      setError(err instanceof Error ? err.message : 'UUID update failed')
    } finally {
      setSyncing(false)
    }
  }

  const syncAllProducts = async () => {
    try {
      setSyncingAll(true)
      setSyncProgress('Starting sync of all products...')

      const response = await fetch('/api/admin/lexoffice/sync', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sync_all: true })
      })

      if (!response.ok) {
        throw new Error('Failed to sync products')
      }

      const result = await response.json()
      setSyncProgress(`Synced ${result.synced_count} of ${result.total_products} products`)

      // Show errors if any
      if (result.errors && result.errors.length > 0) {
        console.error('Sync errors:', result.errors)
        setError(`Some products failed to sync. Check console for details.`)
      }

      // Refresh data after sync
      setTimeout(async () => {
        await fetchData()
        setSyncProgress('')
      }, 2000)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync all products')
      setSyncProgress('')
    } finally {
      setSyncingAll(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <div style={{ padding: '24px' }}>
        <h1>LexOffice Integration Dashboard</h1>
        <p>Loading sync data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <h1>LexOffice Integration Dashboard</h1>
        <div style={{ 
          padding: '16px', 
          backgroundColor: '#fef2f2', 
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#dc2626',
          marginBottom: '16px'
        }}>
          Error: {error}
        </div>
        <button 
          onClick={fetchData}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>
          LexOffice Integration Dashboard
        </h1>
        <p style={{ color: '#6b7280', marginBottom: '16px' }}>
          Manage product synchronization with LexOffice accounting system
        </p>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{
            padding: '8px 16px',
            backgroundColor: '#dcfce7',
            color: '#166534',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            {data?.total || 0} variants synced
          </div>

          <button
            onClick={syncAllProducts}
            disabled={syncingAll || syncing}
            style={{
              padding: '8px 16px',
              backgroundColor: syncingAll ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: (syncingAll || syncing) ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            {syncingAll ? '🔄 Syncing All Products...' : '🚀 Sync All Products'}
          </button>

          <button
            onClick={updateUuids}
            disabled={syncing || syncingAll}
            style={{
              padding: '8px 16px',
              backgroundColor: syncing ? '#9ca3af' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: (syncing || syncingAll) ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            {syncing ? '⏳ Updating...' : '💾 Update All UUIDs in Database'}
          </button>

          <button
            onClick={fetchData}
            disabled={syncingAll || syncing}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: (syncingAll || syncing) ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            🔄 Refresh Data
          </button>
        </div>

        {syncProgress && (
          <div style={{
            marginTop: '12px',
            padding: '12px 16px',
            backgroundColor: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '6px',
            color: '#0369a1',
            fontSize: '14px'
          }}>
            {syncProgress}
          </div>
        )}
      </div>

      {(!data?.mappings || data.mappings.length === 0) ? (
        <div style={{
          padding: '48px',
          textAlign: 'center',
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '8px'
        }}>
          <h2 style={{ fontSize: '20px', marginBottom: '8px', color: '#374151' }}>
            No Synced Products Found
          </h2>
          <p style={{ color: '#6b7280', marginBottom: '16px' }}>
            Create or update products in your admin dashboard to see them here.
          </p>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
            Products are automatically synced when created or updated.
          </p>
        </div>
      ) : (
        <div style={{ 
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '16px',
            backgroundColor: '#f9fafb',
            borderBottom: '1px solid #e5e7eb',
            fontWeight: '600',
            display: 'grid',
            gridTemplateColumns: '2fr 2fr 3fr 2fr 2fr',
            gap: '16px'
          }}>
            <div>Product ID</div>
            <div>Variant ID</div>  
            <div>LexOffice UUID</div>
            <div>SKU</div>
            <div>Last Synced</div>
          </div>

          {data.mappings.map((mapping, index) => (
            <div
              key={`${mapping.medusa_variant_id}-${index}`}
              style={{
                padding: '16px',
                borderBottom: index < data.mappings.length - 1 ? '1px solid #f3f4f6' : 'none',
                display: 'grid',
                gridTemplateColumns: '2fr 2fr 3fr 2fr 2fr',
                gap: '16px',
                alignItems: 'center',
                fontSize: '14px'
              }}
            >
              <div style={{ 
                fontFamily: 'monospace', 
                color: '#374151',
                fontSize: '12px'
              }}>
                {mapping.medusa_product_id || 'N/A'}
              </div>
              
              <div style={{ 
                fontFamily: 'monospace', 
                color: '#374151',
                fontSize: '12px'
              }}>
                {mapping.medusa_variant_id}
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="text"
                  value={mapping.lexoffice_uuid}
                  readOnly
                  style={{
                    padding: '4px 8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    backgroundColor: '#f9fafb',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    width: '200px'
                  }}
                />
                <button
                  onClick={() => navigator.clipboard.writeText(mapping.lexoffice_uuid)}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: '3px',
                    fontSize: '10px',
                    cursor: 'pointer'
                  }}
                >
                  Copy
                </button>
              </div>
              
              <div style={{ 
                fontFamily: 'monospace',
                color: '#6b7280',
                fontSize: '12px'
              }}>
                {mapping.sku || 'N/A'}
              </div>
              
              <div style={{ 
                color: '#6b7280',
                fontSize: '12px'
              }}>
                {mapping.last_synced ? new Date(mapping.last_synced).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ 
        marginTop: '24px',
        padding: '16px',
        backgroundColor: '#f0f9ff',
        border: '1px solid #bae6fd',
        borderRadius: '8px'
      }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#0369a1' }}>
          Quick Actions
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '12px' }}>
          <a 
            href="/admin/products" 
            style={{ 
              padding: '12px', 
              backgroundColor: 'white', 
              border: '1px solid #bae6fd', 
              borderRadius: '6px',
              textDecoration: 'none',
              color: '#0369a1',
              textAlign: 'center',
              fontSize: '14px'
            }}
          >
            📦 Manage Products
          </a>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px',
              backgroundColor: 'white',
              border: '1px solid #bae6fd',
              borderRadius: '6px',
              color: '#0369a1',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            🔄 Refresh Page
          </button>
        </div>
      </div>
    </div>
  )
}

export default LexOfficeDashboard