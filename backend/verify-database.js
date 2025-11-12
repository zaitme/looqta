/**
 * Verify database migration completed successfully
 * Run with: node verify-database.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./src/db/mysql');

async function verifyDatabase() {
  console.log('🔍 Verifying database migration...\n');

  const tables = [
    'price_history',
    'user_price_alerts',
    'affiliate_clicks',
    'product_shipping',
    'coupons',
    'reviews'
  ];

  const columns = [
    { table: 'products', columns: ['affiliate_url', 'seller_rating', 'seller_rating_count', 'seller_type', 'source_sku', 'shipping_info', 'image_url', 'product_id'] }
  ];

  let allPassed = true;

  // Check tables
  console.log('📋 Checking tables...');
  for (const table of tables) {
    try {
      const [rows] = await db.execute(`SHOW TABLES LIKE ?`, [table]);
      if (rows.length > 0) {
        console.log(`  ✅ Table '${table}' exists`);
      } else {
        console.log(`  ❌ Table '${table}' NOT found`);
        allPassed = false;
      }
    } catch (error) {
      console.log(`  ❌ Error checking table '${table}':`, error.message);
      allPassed = false;
    }
  }
  console.log('');

  // Check columns
  console.log('📋 Checking columns...');
  for (const { table, columns: cols } of columns) {
    try {
      const [rows] = await db.execute(`SHOW COLUMNS FROM ${table}`);
      const existingColumns = rows.map(r => r.Field);
      
      for (const col of cols) {
        if (existingColumns.includes(col)) {
          console.log(`  ✅ Column '${table}.${col}' exists`);
        } else {
          console.log(`  ❌ Column '${table}.${col}' NOT found`);
          allPassed = false;
        }
      }
    } catch (error) {
      console.log(`  ❌ Error checking columns in '${table}':`, error.message);
      allPassed = false;
    }
  }
  console.log('');

  // Check indexes
  console.log('📋 Checking indexes...');
  const indexChecks = [
    { table: 'price_history', index: 'idx_product_id' },
    { table: 'price_history', index: 'idx_scraped_at' },
    { table: 'user_price_alerts', index: 'idx_user_id' },
    { table: 'user_price_alerts', index: 'idx_product_id' },
    { table: 'affiliate_clicks', index: 'idx_product_id' }
  ];

  for (const { table, index } of indexChecks) {
    try {
      const [rows] = await db.execute(`SHOW INDEXES FROM ${table} WHERE Key_name = ?`, [index]);
      if (rows.length > 0) {
        console.log(`  ✅ Index '${table}.${index}' exists`);
      } else {
        console.log(`  ⚠️  Index '${table}.${index}' not found (may be optional)`);
      }
    } catch (error) {
      console.log(`  ⚠️  Could not check index '${table}.${index}':`, error.message);
    }
  }
  console.log('');

  if (allPassed) {
    console.log('✨ Database verification PASSED! All tables and columns are in place.\n');
    console.log('Next steps:');
    console.log('1. Start the backend: npm start');
    console.log('2. Run a search to generate price history data');
    console.log('3. Test the APIs: node test-modernization-apis.js');
  } else {
    console.log('❌ Database verification FAILED! Please check the migration.\n');
    console.log('To re-run migration:');
    console.log('  mysql -u looqta_dbuser -p looqta < sql/migrations/2025_add_price_history_and_alerts.sql');
  }

  process.exit(allPassed ? 0 : 1);
}

verifyDatabase().catch(error => {
  console.error('❌ Verification error:', error);
  process.exit(1);
});
