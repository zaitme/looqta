/**
 * SWR Cache Tests
 * PHASE 5: Testing, Validation & Metrics
 */

const cacheService = require('../src/services/cacheService');

describe('SWR Cache Service', () => {
  beforeEach(async () => {
    // Clear cache before each test
    await cacheService.del('test:key');
  });

  test('should set and get cache with metadata', async () => {
    const key = 'test:key';
    const data = { test: 'data' };
    const ttlSeconds = 60;

    await cacheService.setCache(key, data, ttlSeconds, 'fresh');
    const cached = await cacheService.getCache(key);

    expect(cached).not.toBeNull();
    expect(cached.data).toEqual(data);
    expect(cached.source).toBe('fresh');
    expect(cached.fetchedAt).toBeDefined();
    expect(cached.is_stale).toBe(false);
  });

  test('should detect stale cache', async () => {
    const key = 'test:key';
    const data = { test: 'data' };
    const ttlSeconds = 60;
    const freshnessThresholdMinutes = 1; // 1 minute threshold

    await cacheService.setCache(key, data, ttlSeconds, 'fresh');
    
    // Wait a bit and check with very short threshold
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const cached = await cacheService.getCache(key, freshnessThresholdMinutes / 60); // Convert to hours
    expect(cached.is_stale).toBe(false); // Should not be stale yet
    
    // Check with very short threshold (should be stale)
    const staleCached = await cacheService.getCache(key, 0.001); // 0.001 minutes = very short
    expect(staleCached.is_stale).toBe(true);
  });

  test('should invalidate cache', async () => {
    const key = 'test:key';
    const data = { test: 'data' };

    await cacheService.setCache(key, data, 60);
    await cacheService.invalidateCache(key);
    
    const cached = await cacheService.getCache(key);
    expect(cached).toBeNull();
  });

  test('should generate correct cache keys', () => {
    const productKey = cacheService.getProductKey('amazon.sa', 'B08XXX');
    expect(productKey).toBe('product:amazon.sa:B08XXX');

    const searchKey = cacheService.getSearchKey('iPhone 15');
    expect(searchKey).toBe('search:iphone 15');
  });
});
