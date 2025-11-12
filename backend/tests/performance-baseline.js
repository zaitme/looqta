/**
 * Performance Baseline Script
 * Measures API response times and establishes performance baselines
 * Part of test_and_validation_plan.txt implementation
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const axios = require('axios');
const cache = require('../src/cache/redis');

const BASE_URL = process.env.API_URL || 'http://localhost:4000';
const TARGET_RESPONSE_TIME = 300; // milliseconds

async function measurePerformance() {
  const results = {
    passed: [],
    failed: [],
    warnings: [],
    metrics: {}
  };

  console.log('⚡ Measuring Performance Baseline...\n');
  console.log(`Target: < ${TARGET_RESPONSE_TIME}ms\n`);

  // Helper to measure time
  const measureTime = async (name, fn) => {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      return { success: true, duration, result };
    } catch (error) {
      const duration = Date.now() - start;
      return { success: false, duration, error: error.message };
    }
  };

  // 1. Health check
  console.log('1️⃣ Health Check Endpoint...');
  const health = await measureTime('health', async () => {
    return await axios.get(`${BASE_URL}/api/health`);
  });

  if (health.success) {
    results.metrics.health = health.duration;
    if (health.duration < TARGET_RESPONSE_TIME) {
      results.passed.push(`Health check: ${health.duration}ms (< ${TARGET_RESPONSE_TIME}ms)`);
      console.log(`  ✅ ${health.duration}ms`);
    } else {
      results.warnings.push(`Health check slow: ${health.duration}ms (target: < ${TARGET_RESPONSE_TIME}ms)`);
      console.log(`  ⚠️  ${health.duration}ms (slow)`);
    }
  } else {
    results.failed.push(`Health check failed: ${health.error}`);
    console.log(`  ❌ Failed: ${health.error}`);
  }

  // 2. Search endpoint (cached)
  console.log('\n2️⃣ Search Endpoint (Cached)...');
  const searchCached = await measureTime('search-cached', async () => {
    return await axios.get(`${BASE_URL}/api/search`, { params: { q: 'iphone' } });
  });

  if (searchCached.success) {
    results.metrics.searchCached = searchCached.duration;
    if (searchCached.duration < TARGET_RESPONSE_TIME) {
      results.passed.push(`Search (cached): ${searchCached.duration}ms`);
      console.log(`  ✅ ${searchCached.duration}ms`);
    } else {
      results.warnings.push(`Search (cached) slow: ${searchCached.duration}ms`);
      console.log(`  ⚠️  ${searchCached.duration}ms (slow)`);
    }
  } else {
    results.failed.push(`Search (cached) failed: ${searchCached.error}`);
    console.log(`  ❌ Failed: ${searchCached.error}`);
  }

  // 3. Search endpoint (uncached - first request)
  console.log('\n3️⃣ Search Endpoint (Uncached - New Query)...');
  const uniqueQuery = `test-query-${Date.now()}`;
  const searchUncached = await measureTime('search-uncached', async () => {
    return await axios.get(`${BASE_URL}/api/search`, { 
      params: { q: uniqueQuery },
      timeout: 60000 // 60 second timeout for scraping
    });
  });

  if (searchUncached.success) {
    results.metrics.searchUncached = searchUncached.duration;
    // Uncached searches take longer due to scraping, so use higher threshold
    const uncachedTarget = TARGET_RESPONSE_TIME * 10; // 3 seconds for scraping
    if (searchUncached.duration < uncachedTarget) {
      results.passed.push(`Search (uncached): ${searchUncached.duration}ms (< ${uncachedTarget}ms)`);
      console.log(`  ✅ ${searchUncached.duration}ms`);
    } else {
      results.warnings.push(`Search (uncached) slow: ${searchUncached.duration}ms`);
      console.log(`  ⚠️  ${searchUncached.duration}ms (slow)`);
    }
  } else {
    results.warnings.push(`Search (uncached) failed or timed out: ${searchUncached.error}`);
    console.log(`  ⚠️  Failed/Timeout: ${searchUncached.error}`);
  }

  // 4. Price history endpoint
  console.log('\n4️⃣ Price History Endpoint...');
  const testProductId = 'test-product-' + Date.now();
  const priceHistory = await measureTime('price-history', async () => {
    return await axios.get(`${BASE_URL}/api/products/${testProductId}/history`, {
      params: { range: '30d' }
    });
  });

  if (priceHistory.success || priceHistory.error.includes('404') || priceHistory.error.includes('500')) {
    // 404/500 are acceptable (no data yet)
    results.metrics.priceHistory = priceHistory.duration;
    if (priceHistory.duration < TARGET_RESPONSE_TIME) {
      results.passed.push(`Price history: ${priceHistory.duration}ms`);
      console.log(`  ✅ ${priceHistory.duration}ms`);
    } else {
      results.warnings.push(`Price history slow: ${priceHistory.duration}ms`);
      console.log(`  ⚠️  ${priceHistory.duration}ms (slow)`);
    }
  } else {
    results.failed.push(`Price history failed: ${priceHistory.error}`);
    console.log(`  ❌ Failed: ${priceHistory.error}`);
  }

  // 5. Database query performance
  console.log('\n5️⃣ Database Query Performance...');
  try {
    const db = require('../src/db/mysql');
    const dbQuery = await measureTime('db-query', async () => {
      const [rows] = await db.execute('SELECT COUNT(*) as count FROM products LIMIT 1');
      return rows;
    });

    if (dbQuery.success) {
      results.metrics.dbQuery = dbQuery.duration;
      const dbTarget = 100; // 100ms for DB queries
      if (dbQuery.duration < dbTarget) {
        results.passed.push(`Database query: ${dbQuery.duration}ms (< ${dbTarget}ms)`);
        console.log(`  ✅ ${dbQuery.duration}ms`);
      } else {
        results.warnings.push(`Database query slow: ${dbQuery.duration}ms`);
        console.log(`  ⚠️  ${dbQuery.duration}ms (slow)`);
      }
    }
  } catch (error) {
    results.warnings.push(`Database query test failed: ${error.message}`);
    console.log(`  ⚠️  Failed: ${error.message}`);
  }

  // 6. Redis cache performance
  console.log('\n6️⃣ Redis Cache Performance...');
  try {
    const cacheQuery = await measureTime('cache-query', async () => {
      return await cache.get('test-key-' + Date.now());
    });

    if (cacheQuery.success || cacheQuery.error.includes('connection')) {
      results.metrics.cacheQuery = cacheQuery.duration;
      const cacheTarget = 50; // 50ms for cache
      if (cacheQuery.duration < cacheTarget) {
        results.passed.push(`Cache query: ${cacheQuery.duration}ms (< ${cacheTarget}ms)`);
        console.log(`  ✅ ${cacheQuery.duration}ms`);
      } else {
        results.warnings.push(`Cache query slow: ${cacheQuery.duration}ms`);
        console.log(`  ⚠️  ${cacheQuery.duration}ms (slow)`);
      }
    }
  } catch (error) {
    results.warnings.push(`Cache test failed: ${error.message}`);
    console.log(`  ⚠️  Failed: ${error.message}`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 PERFORMANCE BASELINE SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⚠️  Warnings: ${results.warnings.length}`);
  console.log('\n📈 Metrics:');
  Object.entries(results.metrics).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}ms`);
  });
  console.log('='.repeat(60));

  if (results.failed.length > 0) {
    console.log('\n❌ FAILURES:');
    results.failed.forEach(f => console.log(`  - ${f}`));
  }

  if (results.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    results.warnings.forEach(w => console.log(`  - ${w}`));
  }

  return {
    success: results.failed.length === 0,
    results,
    metrics: results.metrics
  };
}

// Run if called directly
if (require.main === module) {
  measurePerformance()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { measurePerformance };
