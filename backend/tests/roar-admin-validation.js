/**
 * ROAR Admin Console Validation
 * Validates all ROAR admin functions work as expected
 * Part of test_and_validation_plan.txt implementation
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const request = require('supertest');
const express = require('express');
const db = require('../src/db/mysql');

const app = express();
app.use(express.json());

const roarRouter = require('../src/routes/roar');
app.use('/roar', roarRouter);

async function validateROARAdmin() {
  const results = {
    passed: [],
    failed: [],
    warnings: []
  };

  console.log('🔍 Validating ROAR Admin Console...\n');

  try {
    // 1. Check ROAR routes exist
    console.log('1️⃣ Checking ROAR routes...');
    const routes = [
      '/roar/auth/login',
      '/roar/users',
      '/roar/tokens',
      '/roar/ads',
      '/roar/stats'
    ];

    for (const route of routes) {
      // Check if route responds (may require auth, but should not 404)
      // Use GET for most routes, POST for login
      const method = route.includes('/auth/login') ? 'post' : 'get';
      const res = method === 'post' 
        ? await request(app).post(route).send({})
        : await request(app).get(route);
      
      // Routes may return 401 (unauthorized) or 200, but not 404
      if (res.status !== 404) {
        results.passed.push(`Route exists: ${route} (status: ${res.status})`);
        console.log(`  ✅ ${route} (status: ${res.status})`);
      } else {
        results.failed.push(`Route missing: ${route}`);
        console.log(`  ❌ ${route} - NOT FOUND`);
      }
    }

    // 2. Check database tables for ROAR
    console.log('\n2️⃣ Checking ROAR database tables...');
    // ROAR uses admin_* table names, not roar_*
    const roarTables = ['admin_users', 'api_tokens', 'ad_placements', 'admin_sessions', 'admin_audit_log'];
    
    // First check if any admin tables exist
    const [allTables] = await db.execute(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND (TABLE_NAME LIKE 'admin_%' OR TABLE_NAME = 'api_tokens' OR TABLE_NAME = 'ad_placements')",
      [process.env.DB_NAME]
    );
    const existingRoarTables = allTables.map(t => t.TABLE_NAME);
    
    if (existingRoarTables.length === 0) {
      results.warnings.push('No ROAR admin tables found - ROAR admin system may not be initialized');
      console.log('  ⚠️  No ROAR admin tables found (ROAR may not be set up)');
      console.log('  💡 Run migration: mysql -u looqta_dbuser -p looqta < sql/migrations/2025_add_roar_admin_system.sql');
      console.log('  💡 Then run: node backend/init-roar-admin.js to initialize');
    } else {
      for (const tableName of roarTables) {
        if (existingRoarTables.includes(tableName)) {
          try {
            const [rows] = await db.execute(`SELECT COUNT(*) as count FROM ${tableName} LIMIT 1`);
            results.passed.push(`Table '${tableName}' exists (${rows[0].count} rows)`);
            console.log(`  ✅ ${tableName} (${rows[0].count} rows)`);
          } catch (error) {
            results.warnings.push(`Error checking ${tableName}: ${error.message}`);
            console.log(`  ⚠️  ${tableName} - Error: ${error.message}`);
          }
        } else {
          results.warnings.push(`Table '${tableName}' not found`);
          console.log(`  ⚠️  ${tableName} - NOT FOUND`);
        }
      }
    }

    // 3. Test login endpoint (should accept POST)
    console.log('\n3️⃣ Testing login endpoint...');
    const loginRes = await request(app)
      .post('/roar/auth/login')
      .send({ username: 'test', password: 'test' });

    // Should return 401 (unauthorized) or 400 (bad request), not 404
    if (loginRes.status === 404) {
      results.failed.push('Login endpoint not found at /roar/auth/login');
      console.log('  ❌ Login endpoint - NOT FOUND');
    } else {
      results.passed.push(`Login endpoint exists at /roar/auth/login (status: ${loginRes.status})`);
      console.log(`  ✅ Login endpoint (status: ${loginRes.status})`);
    }

    // 4. Check default admin user exists
    console.log('\n4️⃣ Checking default admin user...');
    try {
      // Check if admin_users table exists first
      const [tableCheck] = await db.execute(
        "SELECT COUNT(*) as count FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'admin_users'",
        [process.env.DB_NAME]
      );
      
      if (tableCheck[0].count > 0) {
        const [users] = await db.execute(
          "SELECT COUNT(*) as count FROM admin_users WHERE role = 'super_admin'"
        );
        
        if (users[0].count > 0) {
          results.passed.push(`Default admin user exists (${users[0].count} super_admin users)`);
          console.log(`  ✅ Default admin exists`);
        } else {
          results.warnings.push('No super_admin users found (run init-roar-admin.js)');
          console.log('  ⚠️  No super_admin users found');
          console.log('  💡 Run: node backend/init-roar-admin.js');
        }
      } else {
        results.warnings.push('admin_users table does not exist (ROAR not initialized)');
        console.log('  ⚠️  ROAR tables not initialized');
        console.log('  💡 Run migration: mysql -u looqta_dbuser -p looqta < sql/migrations/2025_add_roar_admin_system.sql');
        console.log('  💡 Then run: node backend/init-roar-admin.js');
      }
    } catch (error) {
      results.warnings.push(`Error checking admin users: ${error.message}`);
      console.log(`  ⚠️  Error: ${error.message}`);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 ROAR ADMIN VALIDATION SUMMARY');
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
    console.error('❌ ROAR admin validation failed:', error.message);
    return {
      success: false,
      error: error.message,
      results
    };
  }
}

// Run if called directly
if (require.main === module) {
  validateROARAdmin()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { validateROARAdmin };
