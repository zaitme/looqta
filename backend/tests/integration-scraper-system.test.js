/**
 * Integration Test for High-Efficiency Scraper System
 * Tests the complete flow: validation -> upsert -> metrics -> cache
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { validateRecord, validateRecords } = require('../src/utils/product-validation');
const { upsertProductAtomic } = require('../src/utils/product-upsert');
const cache = require('../src/cache/redis');
const { incrementSearchCount, flushMetricsToDatabase } = require('../src/utils/product-metrics');
const db = require('../src/db/mysql');

describe('High-Efficiency Scraper Integration', () => {
  const testProduct = {
    product_name: 'Test Product Integration',
    price: 199.99,
    currency: 'SAR',
    url: 'https://amazon.sa/dp/TEST123',
    site: 'amazon',
    image_url: 'https://example.com/image.jpg'
  };

  test('Complete flow: Validate -> Upsert -> Cache -> Metrics', async () => {
    // 1. Validate product
    const validated = validateRecord(testProduct, { query: 'test', site: 'amazon' });
    
    expect(validated.is_valid).toBe(true);
    expect(validated.product_id).toBeTruthy();
    expect(validated.price_amount).toBe(199.99);
    expect(validated.price_currency).toBe('SAR');
    
    // 2. Upsert to database
    const upsertResult = await upsertProductAtomic(validated);
    expect(upsertResult.success).toBe(true);
    expect(upsertResult.productId).toBe(validated.product_id);
    
    // 3. Update cache
    const cacheKey = `product:test:${validated.product_id}`;
    await cache.setWithMetadata(cacheKey, validated, 3600, 'fresh');
    
    const cached = await cache.getWithMetadata(cacheKey);
    expect(cached).toBeTruthy();
    expect(cached.data).toBeTruthy();
    expect(cached.fetchedAt).toBeTruthy();
    
    // 4. Track metrics
    await incrementSearchCount(validated.product_id);
    
    // Verify Redis counter
    const metricsKey = `metrics:search_count:${validated.product_id}`;
    const count = await cache.client.get(metricsKey);
    expect(parseInt(count)).toBeGreaterThan(0);
    
    // Cleanup
    await cache.del(cacheKey);
    await cache.client.del(metricsKey);
    
    // Cleanup database (optional - comment out to keep test data)
    try {
      await db.execute('DELETE FROM products WHERE product_id = ?', [validated.product_id]);
      await db.execute('DELETE FROM price_history WHERE product_id = ?', [validated.product_id]);
    } catch (e) {
      // Ignore cleanup errors
    }
  }, 30000);

  test('Validation pipeline rejects invalid products', () => {
    const invalidProducts = [
      { price: 100 }, // Missing required fields
      { product_name: 'Test', price: -10, url: 'https://test.com', site: 'test' }, // Invalid price
      { product_name: 'Test', price: 100, url: 'not-a-url', site: 'test' } // Invalid URL
    ];

    invalidProducts.forEach(product => {
      expect(() => validateRecord(product)).toThrow();
    });
  });

  test('Batch validation handles mixed valid/invalid', () => {
    const products = [
      { product_name: 'Valid 1', price: 100, url: 'https://test.com', site: 'test' },
      { price: 100 }, // Invalid
      { product_name: 'Valid 2', price: 200, url: 'https://test.com', site: 'test' }
    ];

    const { valid, invalid } = validateRecords(products);
    expect(valid.length).toBe(2);
    expect(invalid.length).toBe(1);
  });

  test('Cache SWR metadata works correctly', async () => {
    const testData = [{ name: 'test' }];
    const key = 'test:swr:integration';
    
    // Set with metadata
    await cache.setWithMetadata(key, testData, 3600, 'fresh');
    
    // Get with metadata
    const cached = await cache.getWithMetadata(key, 120); // 2 hour threshold
    
    expect(cached).toBeTruthy();
    expect(cached.source).toBe('fresh');
    expect(cached.fetchedAt).toBeTruthy();
    expect(cached.is_stale).toBe(false);
    
    // Cleanup
    await cache.del(key);
  });
});
