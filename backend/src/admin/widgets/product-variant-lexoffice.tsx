import React, { useEffect, useState } from 'react'
import { AdminProductVariant, DetailWidgetProps } from '@medusajs/framework/types'
import { defineWidgetConfig } from '@medusajs/admin-sdk'

const ProductVariantLexofficeWidget: React.FC<DetailWidgetProps<AdminProductVariant>> = ({ data }) => {
  const variant = data
  const [lexofficeUuid, setLexofficeUuid] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Debug: Log variant data
    console.log('Variant data:', variant)
    console.log('Variant metadata:', variant.metadata)
    console.log('Variant lexoffice_uuid from metadata:', variant.metadata?.lexoffice_uuid)
    console.log('Variant lexoffice_uuid from field:', (variant as any).lexoffice_uuid)
    
    // Check if variant has lexoffice_uuid in metadata or as direct field
    const uuidFromMetadata = variant.metadata?.lexoffice_uuid
    const uuidFromField = (variant as any).lexoffice_uuid
    
    if (uuidFromMetadata || uuidFromField) {
      setLexofficeUuid(uuidFromMetadata || uuidFromField)
      return
    }

    // If not in variant data, fetch from sync mappings
    setLoading(true)
    fetch('/admin/lexoffice/sync')
      .then(res => res.json())
      .then(result => {
        console.log('Sync mappings result:', result)
        const mapping = result.mappings?.find((m: any) => m.medusaVariantId === variant.id)
        console.log('Found mapping for variant:', mapping)
        if (mapping) {
          setLexofficeUuid(mapping.lexofficeVariantId)
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch LexOffice UUID:', err)
        setLoading(false)
      })
  }, [variant.id])

  const copyToClipboard = () => {
    if (lexofficeUuid) {
      navigator.clipboard.writeText(lexofficeUuid)
    }
  }

  if (loading) {
    return (
      <div style={{ 
        padding: '16px', 
        backgroundColor: '#f9fafb', 
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        marginBottom: '16px'
      }}>
        <div style={{ fontSize: '14px', color: '#6b7280' }}>
          Loading LexOffice UUID...
        </div>
      </div>
    )
  }

  return (
    <div style={{ 
      padding: '16px', 
      backgroundColor: '#f9fafb', 
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      marginBottom: '16px'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '8px'
      }}>
        <h3 style={{ 
          margin: 0, 
          fontSize: '16px', 
          fontWeight: '600',
          color: '#374151'
        }}>
          LexOffice Integration
        </h3>
        
        {lexofficeUuid && (
          <div style={{
            padding: '4px 8px',
            backgroundColor: '#dcfce7',
            color: '#166534',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '500'
          }}>
            Synced
          </div>
        )}
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ 
          display: 'block', 
          fontSize: '14px', 
          fontWeight: '500', 
          marginBottom: '4px',
          color: '#374151'
        }}>
          LexOffice Article UUID
        </label>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px'
        }}>
          <input
            type="text"
            value={lexofficeUuid || 'Not synced'}
            readOnly
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: 'white',
              fontFamily: lexofficeUuid ? 'monospace' : 'inherit',
              fontSize: '14px',
              color: lexofficeUuid ? '#374151' : '#9ca3af'
            }}
          />
          
          {lexofficeUuid && (
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
      </div>
      
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center'
      }}>
        <p style={{ 
          fontSize: '12px', 
          color: '#6b7280', 
          margin: 0,
          flex: 1
        }}>
          {lexofficeUuid 
            ? 'This variant is synced with LexOffice. Use the LexOffice tab to manage sync settings.'
            : 'This variant has not been synced to LexOffice yet. Use the LexOffice tab to sync this product.'
          }
        </p>

        {/* Add a small link to the LexOffice sync page */}
        <button
          onClick={() => {
            // Navigate to the LexOffice sync page - need to get product ID from variant
            const productId = (variant as any).product_id || (variant as any).product?.id
            if (productId) {
              window.location.href = `/app/products/${productId}/lexoffice`
            }
          }}
          style={{
            padding: '4px 8px',
            backgroundColor: 'transparent',
            color: '#3b82f6',
            border: '1px solid #3b82f6',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px',
            marginLeft: '8px'
          }}
        >
          Manage Sync
        </button>
      </div>
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: "product_variant.details.after",
})

export default ProductVariantLexofficeWidget