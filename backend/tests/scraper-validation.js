/**
 * Scraper Validation Script
 * Validates scrapers are working correctly and updating database
 * Part of test_and_validation_plan.txt implementation
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const db = require('../src/db/mysql');
const logger = require('../src/utils/logger');
const registry = require('../src/scrapers/scraperRegistry');

async function validateScrapers() {
  const results = {
    passed: [],
    failed: [],
    warnings: []
  };

  console.log('🔍 Validating Scrapers...\n');

  try {
    // 1. Check scrapers are registered
    console.log('1️⃣ Checking scraper registry...');
    const scrapers = registry.getActiveScrapers();
    console.log(`  Found ${scrapers.length} active scraper(s)`);
    
    if (scrapers.length > 0) {
      scrapers.forEach(scraper => {
        const name = scraper.name || scraper.constructor?.name || 'unknown';
        results.passed.push(`Scraper registered: ${name}`);
        console.log(`  ✅ ${name}`);
      });
    } else {
      results.failed.push('No active scrapers found');
      console.log('  ❌ No active scrapers');
    }

    // 2. Check database for recent scrape data
    console.log('\n2️⃣ Checking recent scrape data...');
    try {
      const [recentProducts] = await db.execute(
        'SELECT COUNT(*) as count, MAX(created_at) as latest FROM products WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)'
      );
      
      if (recentProducts[0].count > 0) {
        results.passed.push(`Found ${recentProducts[0].count} products scraped in last 7 days`);
        console.log(`  ✅ ${recentProducts[0].count} products in last 7 days`);
        if (recentProducts[0].latest) {
          console.log(`  Latest: ${recentProducts[0].latest}`);
        }
      } else {
        results.warnings.push('No products scraped in last 7 days (scrapers may not be running)');
        console.log('  ⚠️  No products in last 7 days');
      }
    } catch (error) {
      results.failed.push(`Database query failed: ${error.message}`);
      console.log(`  ❌ Database query failed: ${error.message}`);
    }

    // 3. Check price history logging
    console.log('\n3️⃣ Checking price history logging...');
    try {
      const [priceHistory] = await db.execute(
        'SELECT COUNT(*) as count, MAX(scraped_at) as latest FROM price_history WHERE scraped_at > DATE_SUB(NOW(), INTERVAL 7 DAY)'
      );
      
      if (priceHistory[0].count > 0) {
        results.passed.push(`Found ${priceHistory[0].count} price history entries in last 7 days`);
        console.log(`  ✅ ${priceHistory[0].count} price history entries`);
        if (priceHistory[0].latest) {
          console.log(`  Latest: ${priceHistory[0].latest}`);
        }
      } else {
        results.warnings.push('No price history logged in last 7 days');
        console.log('  ⚠️  No price history entries');
      }
    } catch (error) {
      results.failed.push(`Price history query failed: ${error.message}`);
      console.log(`  ❌ Query failed: ${error.message}`);
    }

    // 4. Check for scraper errors in logs (if accessible)
    console.log('\n4️⃣ Checking scraper health...');
    const testQueries = ['iphone', 'laptop'];
    let successCount = 0;
    
    for (const query of testQueries) {
      try {
        // Try to get cached results (indicates scraper ran)
        const cache = require('../src/cache/redis');
        const cached = await cache.get(`search:${query.toLowerCase().trim()}`);
        
        if (cached) {
          successCount++;
          results.passed.push(`Cache found for query: ${query}`);
          console.log(`  ✅ Cache exists for "${query}"`);
        } else {
          results.warnings.push(`No cache for query: ${query} (may need to run scraper)`);
          console.log(`  ⚠️  No cache for "${query}"`);
        }
      } catch (error) {
        results.warnings.push(`Cache check failed for ${query}: ${error.message}`);
        console.log(`  ⚠️  Cache check failed: ${error.message}`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SCRAPER VALIDATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${results.passed.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);
    console.log(`⚠️  Warnings: ${results.warnings.length}`);
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
      results
    };

  } catch (error) {
    console.error('❌ Scraper validation failed:', error.message);
    return {
      success: false,
      error: error.message,
      results
    };
  }
}

// Run if called directly
if (require.main === module) {
  validateScrapers()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { validateScrapers };
