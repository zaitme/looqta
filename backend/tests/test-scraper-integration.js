/**
 * Quick Integration Test for High-Efficiency Scraper System
 * Tests all components work together
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

async function testIntegration() {
  console.log('🧪 Testing High-Efficiency Scraper Integration...\n');
  
  const results = {
    passed: [],
    failed: []
  };

  // Test 1: Validation Pipeline
  console.log('1️⃣ Testing Validation Pipeline...');
  try {
    const { validateRecord } = require('../src/utils/product-validation');
    const testProduct = {
      product_name: 'Test Product',
      price: 199.99,
      url: 'https://amazon.sa/dp/B08XXX',
      site: 'amazon',
      image_url: 'https://example.com/image.jpg'
    };
    
    const validated = validateRecord(testProduct);
    if (validated.is_valid && validated.product_id) {
      results.passed.push('Validation pipeline');
      console.log('  ✅ Validation works');
    } else {
      results.failed.push('Validation pipeline - invalid result');
      console.log('  ❌ Validation failed');
    }
  } catch (e) {
    results.failed.push(`Validation pipeline - ${e.message}`);
    console.log(`  ❌ Validation error: ${e.message}`);
  }

  // Test 2: Cache SWR
  console.log('\n2️⃣ Testing Cache SWR...');
  try {
    const cache = require('../src/cache/redis');
    const testData = [{ name: 'test' }];
    const key = 'test:swr:integration';
    
    await cache.setWithMetadata(key, testData, 60, 'fresh');
    const cached = await cache.getWithMetadata(key);
    
    if (cached && cached.source === 'fresh' && cached.fetchedAt) {
      results.passed.push('Cache SWR');
      console.log('  ✅ Cache SWR works');
    } else {
      results.failed.push('Cache SWR - missing metadata');
      console.log('  ❌ Cache SWR failed');
    }
    
    await cache.del(key);
  } catch (e) {
    results.failed.push(`Cache SWR - ${e.message}`);
    console.log(`  ❌ Cache error: ${e.message}`);
  }

  // Test 3: Metrics Collection
  console.log('\n3️⃣ Testing Metrics Collection...');
  try {
    const { incrementSearchCount } = require('../src/utils/product-metrics');
    const cache = require('../src/cache/redis');
    const testId = 'test_product_' + Date.now();
    
    await incrementSearchCount(testId);
    const count = await cache.client.get(`metrics:search_count:${testId}`);
    
    if (count && parseInt(count) > 0) {
      results.passed.push('Metrics collection');
      console.log('  ✅ Metrics tracking works');
    } else {
      results.failed.push('Metrics collection - counter not found');
      console.log('  ❌ Metrics failed');
    }
    
    await cache.client.del(`metrics:search_count:${testId}`);
  } catch (e) {
    results.failed.push(`Metrics collection - ${e.message}`);
    console.log(`  ❌ Metrics error: ${e.message}`);
  }

  // Test 4: Job Queue
  console.log('\n4️⃣ Testing Job Queue...');
  try {
    const jobQueue = require('../src/utils/job-queue');
    const stats = jobQueue.getStats();
    
    if (stats && typeof stats.queueLength === 'number') {
      results.passed.push('Job queue');
      console.log('  ✅ Job queue works');
    } else {
      results.failed.push('Job queue - invalid stats');
      console.log('  ❌ Job queue failed');
    }
  } catch (e) {
    results.failed.push(`Job queue - ${e.message}`);
    console.log(`  ❌ Job queue error: ${e.message}`);
  }

  // Test 5: Database Connection
  console.log('\n5️⃣ Testing Database Connection...');
  try {
    const db = require('../src/db/mysql');
    await db.execute('SELECT 1');
    
    // Check product_metrics table exists
    const [tables] = await db.execute(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'product_metrics'",
      [process.env.DB_NAME]
    );
    
    if (tables.length > 0) {
      results.passed.push('Database connection');
      console.log('  ✅ Database connected, product_metrics table exists');
    } else {
      results.failed.push('Database - product_metrics table missing');
      console.log('  ❌ product_metrics table missing');
    }
  } catch (e) {
    results.failed.push(`Database - ${e.message}`);
    console.log(`  ❌ Database error: ${e.message}`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 INTEGRATION TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log('='.repeat(60));

  if (results.passed.length > 0) {
    console.log('\n✅ PASSED:');
    results.passed.forEach(p => console.log(`  - ${p}`));
  }

  if (results.failed.length > 0) {
    console.log('\n❌ FAILED:');
    results.failed.forEach(f => console.log(`  - ${f}`));
  }

  if (results.failed.length === 0) {
    console.log('\n✅ All integration tests PASSED!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed - please review above');
    process.exit(1);
  }
}

testIntegration().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
