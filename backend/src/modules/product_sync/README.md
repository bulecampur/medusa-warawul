# Product Sync Module

This module automatically synchronizes products between Medusa and Lexoffice, ensuring that invoice generation uses the correct Lexoffice product IDs.

## Overview

When products are created or updated in Medusa, they are automatically synced to Lexoffice. The module maintains a mapping between Medusa product/variant IDs and their corresponding Lexoffice IDs, which are then used in invoice generation.

## Features

- **Automatic Sync**: Products are automatically synced when created or updated
- **ID Mapping**: Maintains mapping between Medusa and Lexoffice IDs
- **Invoice Integration**: Invoice generation uses actual Lexoffice IDs instead of random ones
- **Error Handling**: Graceful fallback to temporary IDs if sync fails

## How It Works

1. **Product Creation/Update**: When a product is created or updated in Medusa, the `product.created` or `product.updated` event triggers
2. **Automatic Sync**: The subscriber automatically syncs the product to Lexoffice
3. **ID Storage**: The Lexoffice product and variant IDs are stored in memory (can be extended to use database)
4. **Invoice Generation**: When generating invoices, the service retrieves the actual Lexoffice IDs for line items

## Configuration

### Environment Variables

- `LEXWARE_API_KEY`: Your Lexoffice API key

### Module Registration

The module is automatically registered in `medusa-config.ts`:

```typescript
{
  resolve: "./src/modules/product_sync",
},
{
  resolve: "./src/modules/lexoffice",
},
```

## Usage

### Manual Sync

To manually sync all existing products to Lexoffice, run:

```bash
npx medusa seed --seed-file=src/scripts/sync-products-to-lexoffice.ts
```

### API Usage

```typescript
// Get the product sync service
const productSyncService = container.resolve("product_sync");

// Sync a specific product
await productSyncService.syncProduct(product);

// Get Lexoffice ID for a variant
const lexofficeId = productSyncService.getLexofficeVariantId(medusaVariantId);

// Get all mappings (for debugging)
const mappings = productSyncService.getAllMappings();
```

## Data Structure

### LexofficeProductMapping

```typescript
interface LexofficeProductMapping {
  medusaProductId: string;
  medusaVariantId: string;
  lexofficeProductId: string;
  lexofficeVariantId: string;
  sku: string;
  lastSynced: Date;
}
```

## Events

The module listens to these Medusa events:

- `product.created`: Triggers when a new product is created
- `product.updated`: Triggers when an existing product is updated

## Error Handling

- If a product fails to sync, the error is logged but doesn't prevent other products from syncing
- If no Lexoffice ID is found for a variant, a temporary ID is generated with a warning
- All errors are logged for debugging purposes

## Future Enhancements

- **Database Storage**: Store mappings in a database instead of memory
- **Retry Logic**: Implement retry mechanism for failed syncs
- **Batch Processing**: Process multiple products in batches
- **Webhook Support**: Listen to Lexoffice webhooks for real-time updates
- **Conflict Resolution**: Handle conflicts when products are modified in both systems

## Troubleshooting

### Common Issues

1. **API Key Issues**: Ensure `LEXWARE_API_KEY` is set correctly
2. **Network Issues**: Check connectivity to Lexoffice API
3. **Product Data**: Ensure products have required fields (title, variants, prices)

### Debug Logging

The module provides extensive logging. Check your logs for:

- Product sync events
- API responses from Lexoffice
- ID mappings
- Error details

### Manual Verification

You can verify the sync status by:

1. Checking the logs for sync events
2. Using the `getAllMappings()` method
3. Checking the Lexoffice dashboard for synced products
