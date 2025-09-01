import React, { useEffect, useState } from 'react'

interface LexofficeUuidFieldProps {
  variantId: string
  value?: string
}

const LexofficeUuidField: React.FC<LexofficeUuidFieldProps> = ({ variantId, value }) => {
  const [uuid, setUuid] = useState<string>(value || '')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (value) {
      setUuid(value)
      return
    }

    // Fetch UUID from sync mappings if not in metadata
    setLoading(true)
    fetch('/admin/lexoffice/sync')
      .then(res => res.json())
      .then(result => {
        const mapping = result.mappings?.find((m: any) => m.medusa_variant_id === variantId)
        if (mapping) {
          setUuid(mapping.lexoffice_uuid)
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch LexOffice UUID:', err)
        setLoading(false)
      })
  }, [variantId, value])

  const copyToClipboard = () => {
    if (uuid) {
      navigator.clipboard.writeText(uuid)
      // You could add a toast notification here
    }
  }

  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ 
        display: 'block', 
        fontSize: '14px', 
        fontWeight: '500', 
        marginBottom: '4px',
        color: '#374151'
      }}>
        LexOffice UUID
      </label>
      
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px'
      }}>
        <input
          type="text"
          value={loading ? 'Loading...' : (uuid || 'Not synced')}
          readOnly
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            backgroundColor: '#f9fafb',
            fontFamily: uuid ? 'monospace' : 'inherit',
            fontSize: '14px',
            color: uuid ? '#374151' : '#9ca3af'
          }}
        />
        
        {uuid && (
          <button
            type="button"
            onClick={copyToClipboard}
            style={{
              padding: '8px 12px',
              backgroundColor: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              color: '#374151'
            }}
          >
            Copy
          </button>
        )}
      </div>
      
      <p style={{ 
        fontSize: '12px', 
        color: '#6b7280', 
        margin: '4px 0 0 0' 
      }}>
        This UUID is automatically generated when the variant is synced to LexOffice.
        {!uuid && ' Sync this product to generate a UUID.'}
      </p>
    </div>
  )
}

export default LexofficeUuidField