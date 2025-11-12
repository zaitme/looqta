/**
 * Initialize ROAR admin system
 * Creates default admin user and verifies setup
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./src/db/mysql');
const { hashPassword, initializeDefaultAdmin } = require('./src/utils/auth');
const logger = require('./src/utils/logger');

async function init() {
  try {
    console.log('🔧 Initializing ROAR admin system...\n');
    
    // Initialize default admin
    await initializeDefaultAdmin();
    console.log('✅ Default admin user initialized\n');
    
    // Verify admin user
    const [users] = await db.execute(
      `SELECT id, username, email, role, is_active FROM admin_users WHERE username = 'zaitme'`
    );
    
    if (users.length > 0) {
      const admin = users[0];
      console.log('📋 Admin User Details:');
      console.log(`   Username: ${admin.username}`);
      console.log(`   Email: ${admin.email || 'Not set'}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   Status: ${admin.is_active ? 'Active' : 'Inactive'}`);
      console.log(`   ID: ${admin.id}\n`);
    }
    
    // Check tables
    const tables = ['admin_users', 'api_tokens', 'ad_placements', 'admin_sessions', 'admin_audit_log'];
    console.log('📊 Database Tables:');
    for (const table of tables) {
      try {
        const [rows] = await db.execute(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`   ✅ ${table}: ${rows[0].count} records`);
      } catch (error) {
        console.log(`   ❌ ${table}: Table not found - run migration first!`);
      }
    }
    
    console.log('\n✨ ROAR admin system ready!');
    console.log('\n📝 Login Credentials:');
    console.log('   URL: http://localhost:3000/roar');
    console.log('   Username: zaitme');
    console.log('   Password: highrise\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Initialization failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

init();
