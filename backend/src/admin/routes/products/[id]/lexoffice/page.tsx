import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

interface Variant {
  id: string
  title: string
  sku: string
  lexoffice_uuid: string | null
  last_synced: string | null
}

interface ProductData {
  product: {
    id: string
    title: string
    variants: Variant[]
  }
  sync_status: {
    total_variants: number
    synced_variants: number
  }
}

const LexOfficePage: React.FC = () => {
  const { id: productId } = useParams<{ id: string }>()
  const [data, setData] = useState<ProductData | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/products/${productId}/lexoffice`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      if (!response.ok) {
        throw new Error('Failed to fetch LexOffice data')
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

  const syncProduct = async () => {
    try {
      setSyncing(true)
      const response = await fetch(`/api/admin/products/${productId}/lexoffice`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      if (!response.ok) {
        throw new Error('Failed to sync product')
      }

      // Refresh data after sync
      setTimeout(fetchData, 2000) // Wait 2 seconds for sync to complete

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const updateUuids = async () => {
    try {
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
      fetchData()

    } catch (err) {
      setError(err instanceof Error ? err.message : 'UUID update failed')
    }
  }

  useEffect(() => {
    if (productId) {
      fetchData()
    }
  }, [productId])

  if (loading) {
    return (
      <div style={{ padding: '24px' }}>
        <h1>LexOffice Integration</h1>
        <p>Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <h1>LexOffice Integration</h1>
        <div style={{ 
          padding: '16px', 
          backgroundColor: '#fef2f2', 
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#dc2626'
        }}>
          Error: {error}
        </div>
        <button 
          onClick={fetchData}
          style={{
            marginTop: '16px',
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

  if (!data) {
    return null
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
          LexOffice Integration
        </h1>
        <p style={{ color: '#6b7280', marginBottom: '16px' }}>
          Product: {data.product.title}
        </p>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{
            padding: '8px 16px',
            backgroundColor: data.sync_status.synced_variants === data.sync_status.total_variants ? '#dcfce7' : '#fef3c7',
            color: data.sync_status.synced_variants === data.sync_status.total_variants ? '#166534' : '#92400e',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            {data.sync_status.synced_variants} of {data.sync_status.total_variants} variants synced
          </div>
          
          <button
            onClick={syncProduct}
            disabled={syncing}
            style={{
              padding: '8px 16px',
              backgroundColor: syncing ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: syncing ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            {syncing ? 'Syncing...' : 'Sync to LexOffice'}
          </button>

          <button
            onClick={updateUuids}
            style={{
              padding: '8px 16px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Update UUIDs in Database
          </button>
        </div>
      </div>

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
          fontWeight: '600'
        }}>
          Product Variants
        </div>

        {data.product.variants.map((variant, index) => (
          <div
            key={variant.id}
            style={{
              padding: '16px',
              borderBottom: index < data.product.variants.length - 1 ? '1px solid #f3f4f6' : 'none',
              backgroundColor: variant.lexoffice_uuid ? '#f9fafb' : '#fff'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>
                  {variant.title || `SKU: ${variant.sku}`}
                </h3>
                <p style={{ margin: '0 0 8px 0', color: '#6b7280', fontSize: '14px' }}>
                  Variant ID: {variant.id}
                </p>
                {variant.sku && (
                  <p style={{ margin: '0 0 8px 0', color: '#6b7280', fontSize: '14px' }}>
                    SKU: {variant.sku}
                  </p>
                )}
                {variant.last_synced && (
                  <p style={{ margin: '0', color: '#6b7280', fontSize: '12px' }}>
                    Last synced: {new Date(variant.last_synced).toLocaleString()}
                  </p>
                )}
              </div>

              <div style={{ textAlign: 'right', minWidth: '300px' }}>
                {variant.lexoffice_uuid ? (
                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '12px', 
                      color: '#6b7280',
                      marginBottom: '4px'
                    }}>
                      LexOffice UUID:
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="text"
                        value={variant.lexoffice_uuid}
                        readOnly
                        style={{
                          padding: '6px 8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          backgroundColor: '#f9fafb',
                          fontFamily: 'monospace',
                          fontSize: '12px',
                          width: '220px'
                        }}
                      />
                      <button
                        onClick={() => navigator.clipboard.writeText(variant.lexoffice_uuid!)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#f3f4f6',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    padding: '8px 12px',
                    backgroundColor: '#fef3c7',
                    border: '1px solid #fcd34d',
                    borderRadius: '4px',
                    color: '#92400e',
                    fontSize: '12px'
                  }}>
                    Not synced to LexOffice
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ 
        marginTop: '24px',
        padding: '16px',
        backgroundColor: '#f0f9ff',
        border: '1px solid #bae6fd',
        borderRadius: '8px'
      }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#0369a1' }}>
          How LexOffice Integration Works
        </h3>
        <ul style={{ margin: 0, paddingLeft: '20px', color: '#0369a1', fontSize: '14px' }}>
          <li>Products are automatically synced when created or updated</li>
          <li>Each variant gets a unique LexOffice UUID</li>
          <li>UUIDs are used to link Medusa products with LexOffice articles</li>
          <li>Use "Sync to LexOffice" to manually trigger synchronization</li>
          <li>Use "Update UUIDs in Database" to store UUIDs permanently</li>
        </ul>
      </div>
    </div>
  )
}

export default LexOfficePage