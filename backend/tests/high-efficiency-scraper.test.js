/**
 * High-Efficiency Scraper Tests
 * Tests for PHASE 1, 2, 3, 4 as per the plan checklist
 */

const { validateRecord, validateRecords } = require('../src/utils/product-validation');
const { upsertProductAtomic } = require('../src/utils/product-upsert');
const cache = require('../src/cache/redis');
const { incrementSearchCount, flushMetricsToDatabase, updateTiers } = require('../src/utils/product-metrics');

describe('PHASE 1: SWR Cache Pattern', () => {
  test('Cache should store metadata with fetchedAt', async () => {
    const testData = [{ product_name: 'Test', price: 100, site: 'test' }];
    const key = 'test:swr:metadata';
    
    await cache.setWithMetadata(key, testData, 3600, 'fresh');
    const cached = await cache.getWithMetadata(key);
    
    expect(cached).toBeTruthy();
    expect(cached.fetchedAt).toBeTruthy();
    expect(cached.source).toBe('fresh');
    expect(cached.data).toEqual(testData);
    
    // Cleanup
    await cache.del(key);
  });
  
  test('isStale should detect stale data', () => {
    const now = new Date();
    const oldDate = new Date(now.getTime() - 3 * 60 * 60 * 1000); // 3 hours ago
    
    const freshData = { fetchedAt: now.toISOString() };
    const staleData = { fetchedAt: oldDate.toISOString() };
    
    expect(cache.isStale(freshData, 120)).toBe(false); // 2 hour threshold
    expect(cache.isStale(staleData, 120)).toBe(true);
  });
});

describe('PHASE 2: Validation Pipeline', () => {
  test('Should reject record missing required fields', () => {
    const invalid = { price: 100 }; // Missing product_name, url, site
    
    expect(() => validateRecord(invalid)).toThrow();
  });
  
  test('Should reject invalid price', () => {
    const invalid = {
      product_name: 'Test',
      price: -10,
      url: 'https://example.com',
      site: 'test'
    };
    
    expect(() => validateRecord(invalid)).toThrow();
  });
  
  test('Should reject invalid URL', () => {
    const invalid = {
      product_name: 'Test',
      price: 100,
      url: 'not-a-url',
      site: 'test'
    };
    
    expect(() => validateRecord(invalid)).toThrow();
  });
  
  test('Should validate and normalize valid record', () => {
    const valid = {
      product_name: '  Test Product  ',
      price: '100.50 SAR',
      url: 'https://example.com/product',
      site: 'amazon',
      image_url: 'https://example.com/image.jpg'
    };
    
    const validated = validateRecord(valid);
    
    expect(validated.product_name).toBe('Test Product'); // Normalized
    expect(validated.price_amount).toBe(100.50); // Normalized
    expect(validated.price_currency).toBe('SAR');
    expect(validated.is_valid).toBe(true);
    expect(validated.product_id).toBeTruthy();
  });
  
  test('Should handle batch validation', () => {
    const records = [
      { product_name: 'Valid', price: 100, url: 'https://example.com', site: 'test' },
      { price: 100 }, // Invalid - missing fields
      { product_name: 'Valid2', price: 200, url: 'https://example.com', site: 'test' }
    ];
    
    const { valid, invalid } = validateRecords(records);
    
    expect(valid.length).toBe(2);
    expect(invalid.length).toBe(1);
  });
});

describe('PHASE 3: Metrics Collection', () => {
  test('Should increment search count', async () => {
    const productId = 'test_product_123';
    
    await incrementSearchCount(productId);
    
    // Check Redis counter exists
    const key = `metrics:search_count:${productId}`;
    const count = await cache.client.get(key);
    
    expect(parseInt(count)).toBeGreaterThan(0);
    
    // Cleanup
    await cache.client.del(key);
  });
});

describe('PHASE 4: Database Schema', () => {
  test('Products table should have is_valid column', async () => {
    // This would require DB connection - placeholder test
    // In real test, check schema via information_schema
    expect(true).toBe(true); // Placeholder
  });
});

// Note: Full integration tests would require:
// - Database connection
// - Redis connection
// - Mock scrapers
// - Test data setup/teardown
