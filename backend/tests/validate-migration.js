/**
 * Validate High-Efficiency Scraper Database Migration
 * Checks that all schema changes are applied correctly
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mysql = require('mysql2/promise');

// Validate required environment variables
if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
  console.error('❌ Missing required database environment variables: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME must be set in .env file');
  process.exit(1);
}

async function validateMigration() {
  let connection;
  const results = {
    passed: [],
    failed: [],
    warnings: []
  };

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('🔍 Validating High-Efficiency Scraper Migration...\n');

    // 1. Check products table new columns
    console.log('1️⃣ Checking products table columns...');
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
       FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' 
       AND COLUMN_NAME IN ('is_valid', 'site_product_id', 'price_amount', 'price_currency', 'last_checked_at', 'trust_score')
       ORDER BY COLUMN_NAME`,
      [process.env.DB_NAME]
    );

    const requiredColumns = [
      { name: 'is_valid', type: 'tinyint', nullable: 'YES' },
      { name: 'site_product_id', type: 'varchar', nullable: 'YES' },
      { name: 'price_amount', type: 'decimal', nullable: 'YES' },
      { name: 'price_currency', type: 'varchar', nullable: 'YES' },
      { name: 'last_checked_at', type: 'timestamp', nullable: 'YES' },
      { name: 'trust_score', type: 'int', nullable: 'YES' }
    ];

    const foundColumns = columns.map(c => c.COLUMN_NAME);
    for (const reqCol of requiredColumns) {
      if (foundColumns.includes(reqCol.name)) {
        results.passed.push(`Column 'products.${reqCol.name}' exists`);
        console.log(`  ✅ ${reqCol.name}`);
      } else {
        results.failed.push(`Column 'products.${reqCol.name}' missing`);
        console.log(`  ❌ ${reqCol.name} - MISSING`);
      }
    }

    // 2. Check unique index on (site, site_product_id)
    console.log('\n2️⃣ Checking unique index on (site, site_product_id)...');
    const [indexes] = await connection.execute(
      `SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE 
       FROM information_schema.STATISTICS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' 
       AND INDEX_NAME = 'idx_site_product_id'`,
      [process.env.DB_NAME]
    );

    if (indexes.length > 0) {
      const isUnique = indexes.every(idx => idx.NON_UNIQUE === 0);
      if (isUnique) {
        results.passed.push('Unique index idx_site_product_id exists');
        console.log('  ✅ Unique index exists');
      } else {
        results.failed.push('Index idx_site_product_id is not unique');
        console.log('  ❌ Index exists but is not unique');
      }
    } else {
      results.failed.push('Index idx_site_product_id missing');
      console.log('  ❌ Index missing');
    }

    // 3. Check product_metrics table
    console.log('\n3️⃣ Checking product_metrics table...');
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME FROM information_schema.TABLES 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'product_metrics'`,
      [process.env.DB_NAME]
    );

    if (tables.length > 0) {
      results.passed.push('Table product_metrics exists');
      console.log('  ✅ Table exists');

      // Check product_metrics columns
      const [metricsColumns] = await connection.execute(
        `SELECT COLUMN_NAME, DATA_TYPE 
         FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'product_metrics'
         ORDER BY COLUMN_NAME`,
        [process.env.DB_NAME]
      );

      const requiredMetricsColumns = [
        'product_id', 'search_count_week', 'last_scraped_at', 
        'tier', 'is_tracked', 'updated_at'
      ];

      console.log('  Checking columns:');
      for (const col of requiredMetricsColumns) {
        const exists = metricsColumns.some(c => c.COLUMN_NAME === col);
        if (exists) {
          results.passed.push(`Column 'product_metrics.${col}' exists`);
          console.log(`    ✅ ${col}`);
        } else {
          results.failed.push(`Column 'product_metrics.${col}' missing`);
          console.log(`    ❌ ${col} - MISSING`);
        }
      }

      // Check tier ENUM values
      const [tierEnum] = await connection.execute(
        `SELECT COLUMN_TYPE FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'product_metrics' 
         AND COLUMN_NAME = 'tier'`,
        [process.env.DB_NAME]
      );

      if (tierEnum.length > 0) {
        const enumValues = tierEnum[0].COLUMN_TYPE;
        if (enumValues.includes("'HOT'") && enumValues.includes("'WARM'") && enumValues.includes("'COLD'")) {
          results.passed.push('Tier ENUM has correct values (HOT, WARM, COLD)');
          console.log('    ✅ Tier ENUM values correct');
        } else {
          results.failed.push('Tier ENUM missing required values');
          console.log('    ❌ Tier ENUM values incorrect');
        }
      }

    } else {
      results.failed.push('Table product_metrics missing');
      console.log('  ❌ Table missing');
    }

    // 4. Check indexes on products table
    console.log('\n4️⃣ Checking indexes on products table...');
    const [productIndexes] = await connection.execute(
      `SELECT INDEX_NAME, COLUMN_NAME 
       FROM information_schema.STATISTICS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' 
       AND INDEX_NAME IN ('idx_is_valid', 'idx_last_checked_at')`,
      [process.env.DB_NAME]
    );

    const indexNames = [...new Set(productIndexes.map(i => i.INDEX_NAME))];
    if (indexNames.includes('idx_is_valid')) {
      results.passed.push('Index idx_is_valid exists');
      console.log('  ✅ idx_is_valid');
    } else {
      results.warnings.push('Index idx_is_valid missing (optional but recommended)');
      console.log('  ⚠️  idx_is_valid - missing (optional)');
    }

    if (indexNames.includes('idx_last_checked_at')) {
      results.passed.push('Index idx_last_checked_at exists');
      console.log('  ✅ idx_last_checked_at');
    } else {
      results.warnings.push('Index idx_last_checked_at missing (optional but recommended)');
      console.log('  ⚠️  idx_last_checked_at - missing (optional)');
    }

    // 5. Test data integrity - check if existing products have is_valid set
    console.log('\n5️⃣ Checking data integrity...');
    const [productStats] = await connection.execute(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN is_valid = TRUE THEN 1 ELSE 0 END) as valid_count,
         SUM(CASE WHEN is_valid = FALSE THEN 1 ELSE 0 END) as invalid_count,
         SUM(CASE WHEN is_valid IS NULL THEN 1 ELSE 0 END) as null_count
       FROM products`
    );

    const stats = productStats[0];
    console.log(`  Total products: ${stats.total}`);
    console.log(`  Valid (is_valid=TRUE): ${stats.valid_count}`);
    console.log(`  Invalid (is_valid=FALSE): ${stats.invalid_count}`);
    console.log(`  NULL: ${stats.null_count}`);

    if (stats.null_count === 0) {
      results.passed.push('All products have is_valid set (no NULLs)');
      console.log('  ✅ All products have is_valid set');
    } else {
      results.warnings.push(`${stats.null_count} products have NULL is_valid`);
      console.log(`  ⚠️  ${stats.null_count} products have NULL is_valid`);
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

    if (results.failed.length === 0) {
      console.log('\n✅ Migration validation PASSED!');
      process.exit(0);
    } else {
      console.log('\n❌ Migration validation FAILED - please fix issues above');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Validation error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

validateMigration();
