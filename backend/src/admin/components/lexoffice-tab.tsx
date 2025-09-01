import React from 'react'
import { useParams } from 'react-router-dom'

const LexofficeTab: React.FC = () => {
  const { id: productId } = useParams<{ id: string }>()

  return (
    <a 
      href={`/admin/products/${productId}/lexoffice`}
      style={{
        display: 'inline-block',
        padding: '8px 16px',
        backgroundColor: '#f3f4f6',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        textDecoration: 'none',
        color: '#374151',
        fontSize: '14px',
        fontWeight: '500',
        margin: '8px 0'
      }}
    >
      🔗 LexOffice Integration
    </a>
  )
}

export default LexofficeTab