/**
 * Schema Validation Script
 * Validates database schema matches migration requirements
 * Part of test_and_validation_plan.txt implementation
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mysql = require('mysql2/promise');
const logger = require('../src/utils/logger');

// Validate required environment variables
if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
  console.error('❌ Missing required database environment variables: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME must be set in .env file');
  process.exit(1);
}

const REQUIRED_TABLES = [
  'price_history',
  'user_price_alerts',
  'affiliate_clicks',
  'product_shipping',
  'coupons',
  'reviews',
  'products'
];

const REQUIRED_PRODUCTS_COLUMNS = [
  'affiliate_url',
  'seller_rating',
  'seller_rating_count',
  'seller_type',
  'source_sku',
  'shipping_info',
  'image_url',
  'product_id',
  'created_at',
  'updated_at'
];

async function validateSchema() {
  const results = {
    passed: [],
    failed: [],
    warnings: []
  };

  let connection;
  try {
    // Connect to database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('🔍 Validating database schema...\n');

    // 1. Check required tables exist
    console.log('1️⃣ Checking required tables...');
    const [tables] = await connection.execute(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?",
      [process.env.DB_NAME]
    );
    const tableNames = tables.map(t => t.TABLE_NAME);

    for (const tableName of REQUIRED_TABLES) {
      if (tableNames.includes(tableName)) {
        results.passed.push(`Table '${tableName}' exists`);
        console.log(`  ✅ ${tableName}`);
      } else {
        results.failed.push(`Table '${tableName}' missing`);
        console.log(`  ❌ ${tableName} - MISSING`);
      }
    }

    // 2. Check products table columns
    console.log('\n2️⃣ Checking products table columns...');
    const [columns] = await connection.execute(
      "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products'",
      [process.env.DB_NAME]
    );
    const columnNames = columns.map(c => c.COLUMN_NAME);

    for (const colName of REQUIRED_PRODUCTS_COLUMNS) {
      if (columnNames.includes(colName)) {
        const col = columns.find(c => c.COLUMN_NAME === colName);
        results.passed.push(`Column 'products.${colName}' exists (${col.DATA_TYPE})`);
        console.log(`  ✅ products.${colName} (${col.DATA_TYPE})`);
      } else {
        results.failed.push(`Column 'products.${colName}' missing`);
        console.log(`  ❌ products.${colName} - MISSING`);
      }
    }

    // 3. Check indexes on price_history
    console.log('\n3️⃣ Checking indexes on price_history...');
    const [indexes] = await connection.execute(
      "SELECT INDEX_NAME, COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'price_history'",
      [process.env.DB_NAME]
    );
    const requiredIndexes = ['idx_product_id', 'idx_site', 'idx_scraped_at', 'idx_product_site'];
    const existingIndexes = [...new Set(indexes.map(i => i.INDEX_NAME))];

    for (const idxName of requiredIndexes) {
      if (existingIndexes.includes(idxName)) {
        results.passed.push(`Index 'price_history.${idxName}' exists`);
        console.log(`  ✅ ${idxName}`);
      } else {
        results.warnings.push(`Index 'price_history.${idxName}' missing (performance impact)`);
        console.log(`  ⚠️  ${idxName} - MISSING (performance impact)`);
      }
    }

    // 4. Check foreign key constraints (if any)
    console.log('\n4️⃣ Checking foreign key constraints...');
    const [fks] = await connection.execute(
      "SELECT CONSTRAINT_NAME, TABLE_NAME, REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL",
      [process.env.DB_NAME]
    );
    
    if (fks.length > 0) {
      console.log(`  ✅ Found ${fks.length} foreign key constraint(s)`);
      fks.forEach(fk => {
        results.passed.push(`FK: ${fk.TABLE_NAME}.${fk.CONSTRAINT_NAME} -> ${fk.REFERENCED_TABLE_NAME}`);
      });
    } else {
      results.warnings.push('No foreign key constraints found (data integrity not enforced)');
      console.log('  ⚠️  No foreign key constraints found');
    }

    // 5. Check data types
    console.log('\n5️⃣ Validating critical data types...');
    const criticalChecks = [
      { table: 'price_history', column: 'price', expected: 'decimal' },
      { table: 'user_price_alerts', column: 'target_price', expected: 'decimal' },
      { table: 'user_price_alerts', column: 'is_active', expected: 'tinyint' }
    ];

    for (const check of criticalChecks) {
      const [colInfo] = await connection.execute(
        "SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?",
        [process.env.DB_NAME || 'looqta', check.table, check.column]
      );
      
      if (colInfo.length > 0) {
        const actualType = colInfo[0].DATA_TYPE.toLowerCase();
        if (actualType.includes(check.expected) || check.expected.includes(actualType)) {
          results.passed.push(`Data type correct: ${check.table}.${check.column} (${actualType})`);
          console.log(`  ✅ ${check.table}.${check.column} (${actualType})`);
        } else {
          results.warnings.push(`Data type mismatch: ${check.table}.${check.column} (expected ${check.expected}, got ${actualType})`);
          console.log(`  ⚠️  ${check.table}.${check.column} - type mismatch`);
        }
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 VALIDATION SUMMARY');
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

    await connection.end();

    return {
      success: results.failed.length === 0,
      results
    };

  } catch (error) {
    console.error('❌ Schema validation failed:', error.message);
    if (connection) await connection.end();
    return {
      success: false,
      error: error.message,
      results
    };
  }
}

// Run if called directly
if (require.main === module) {
  validateSchema()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { validateSchema };
