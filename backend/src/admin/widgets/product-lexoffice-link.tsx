import React from 'react'
import { AdminProduct, DetailWidgetProps } from '@medusajs/framework/types'
import { defineWidgetConfig } from '@medusajs/admin-sdk'

const ProductLexofficeLinkWidget: React.FC<DetailWidgetProps<AdminProduct>> = ({ data }) => {
  const product = data

  const handleNavigateToLexoffice = () => {
    // Navigate to the admin LexOffice sync page for this product
    window.location.href = `/admin/products/${product.id}/lexoffice`
  }

  return (
    <div style={{ 
      padding: '12px', 
      backgroundColor: 'white', 
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      marginTop: '16px'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center'
      }}>
        <div>
          <h3 style={{ 
            margin: '0 0 2px 0', 
            fontSize: '14px', 
            fontWeight: '500',
            color: '#374151'
          }}>
            LexOffice Integration
          </h3>
          <p style={{ 
            fontSize: '12px', 
            color: '#6b7280', 
            margin: 0
          }}>
            Sync this product and its variants to LexOffice for accounting.
          </p>
        </div>

        <button
          onClick={handleNavigateToLexoffice}
          style={{
            padding: '6px 12px',
            backgroundColor: '#f3f4f6',
            color: '#6b7280',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '400',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
            <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
          </svg>
          Manage Sync
        </button>
      </div>
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductLexofficeLinkWidget