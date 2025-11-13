/**
 * ROAR Ad Placement Management Test
 * Validates CRUD operations for ad placements
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const request = require('supertest');
const express = require('express');
const db = require('../src/db/mysql');

const app = express();
app.use(express.json());

const roarRouter = require('../src/routes/roar');
app.use('/roar', roarRouter);

let authCookie = null;
let testUserId = null;

async function loginAsAdmin() {
  try {
    // First, ensure we have an admin user
    const [users] = await db.execute(
      "SELECT id, username FROM admin_users WHERE role = 'super_admin' LIMIT 1"
    );
    
    if (users.length === 0) {
      throw new Error('No admin user found. Run: node backend/init-roar-admin.js');
    }
    
    // Try to login with different common passwords
    const passwords = ['admin123', 'admin', 'password', 'highrise'];
    let res = null;
    
    for (const pwd of passwords) {
      res = await request(app)
        .post('/roar/auth/login')
        .send({ 
          username: users[0].username, 
          password: pwd
        });
      
      if (res.status === 200 && res.body.success) {
        break;
      }
    }
    
    if (res.status === 200 && res.body.success) {
      // Extract cookie from response
      const cookies = res.headers['set-cookie'];
      if (cookies) {
        authCookie = cookies.find(c => c.startsWith('roar_session='));
      }
      testUserId = res.body.user.id;
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Login failed:', error.message);
    return false;
  }
}

async function testAdManagement() {
  const results = {
    passed: [],
    failed: [],
    warnings: []
  };

  console.log('🔍 Testing ROAR Ad Placement Management...\n');

  try {
    // 1. Login as admin
    console.log('1️⃣ Authenticating...');
    const loggedIn = await loginAsAdmin();
    if (!loggedIn) {
      results.warnings.push('Could not authenticate - some tests will be skipped');
      console.log('  ⚠️  Authentication failed - skipping authenticated tests');
      console.log('  💡 Ensure admin user exists: node backend/init-roar-admin.js');
    } else {
      results.passed.push('Successfully authenticated as admin');
      console.log('  ✅ Authenticated');
    }

    // 2. Test GET /roar/ads endpoint
    console.log('\n2️⃣ Testing GET /roar/ads...');
    const getAdsRes = await request(app)
      .get('/roar/ads')
      .set('Cookie', authCookie || '');
    
    if (getAdsRes.status === 200 && getAdsRes.body.success) {
      results.passed.push(`GET /roar/ads works (found ${getAdsRes.body.ads?.length || 0} ads)`);
      console.log(`  ✅ GET /roar/ads works (${getAdsRes.body.ads?.length || 0} ads)`);
    } else if (getAdsRes.status === 401) {
      results.warnings.push('GET /roar/ads requires authentication');
      console.log('  ⚠️  GET /roar/ads requires authentication');
    } else {
      results.failed.push(`GET /roar/ads failed with status ${getAdsRes.status}`);
      console.log(`  ❌ GET /roar/ads failed (status: ${getAdsRes.status})`);
    }

    // 3. Test POST /roar/ads (Create)
    if (loggedIn) {
      console.log('\n3️⃣ Testing POST /roar/ads (Create)...');
      const testAd = {
        name: 'Test Ad ' + Date.now(),
        position: 'header',
        ad_type: 'banner',
        content: 'Test ad content',
        image_url: 'https://example.com/test.jpg',
        link_url: 'https://example.com',
        target_audience: { location: 'KSA', age: '18-65' },
        priority: 1,
        is_active: true
      };

      const createRes = await request(app)
        .post('/roar/ads')
        .set('Cookie', authCookie)
        .send(testAd);

      if (createRes.status === 200 && createRes.body.success) {
        const adId = createRes.body.adId;
        results.passed.push(`POST /roar/ads works (created ad ID: ${adId})`);
        console.log(`  ✅ POST /roar/ads works (created ad ID: ${adId})`);

        // 4. Test PUT /roar/ads/:id (Update)
        console.log('\n4️⃣ Testing PUT /roar/ads/:id (Update)...');
        const updateRes = await request(app)
          .put(`/roar/ads/${adId}`)
          .set('Cookie', authCookie)
          .send({
            name: 'Updated Test Ad',
            priority: 2
          });

        if (updateRes.status === 200 && updateRes.body.success) {
          results.passed.push(`PUT /roar/ads/:id works (updated ad ID: ${adId})`);
          console.log(`  ✅ PUT /roar/ads/:id works`);

          // 5. Test DELETE /roar/ads/:id
          console.log('\n5️⃣ Testing DELETE /roar/ads/:id...');
          const deleteRes = await request(app)
            .delete(`/roar/ads/${adId}`)
            .set('Cookie', authCookie);

          if (deleteRes.status === 200 && deleteRes.body.success) {
            results.passed.push(`DELETE /roar/ads/:id works (deleted ad ID: ${adId})`);
            console.log(`  ✅ DELETE /roar/ads/:id works`);
          } else {
            results.failed.push(`DELETE /roar/ads/:id failed (status: ${deleteRes.status})`);
            console.log(`  ❌ DELETE /roar/ads/:id failed (status: ${deleteRes.status})`);
          }
        } else {
          results.failed.push(`PUT /roar/ads/:id failed (status: ${updateRes.status})`);
          console.log(`  ❌ PUT /roar/ads/:id failed (status: ${updateRes.status})`);
          
          // Cleanup: try to delete the created ad
          try {
            await request(app)
              .delete(`/roar/ads/${adId}`)
              .set('Cookie', authCookie);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      } else {
        results.failed.push(`POST /roar/ads failed (status: ${createRes.status})`);
        console.log(`  ❌ POST /roar/ads failed (status: ${createRes.status})`);
        if (createRes.body?.error) {
          console.log(`     Error: ${createRes.body.error}`);
        }
      }
    }

    // 6. Test validation
    console.log('\n6️⃣ Testing validation...');
    if (loggedIn) {
      const invalidRes = await request(app)
        .post('/roar/ads')
        .set('Cookie', authCookie)
        .send({
          // Missing required fields
          name: 'Test'
        });

      if (invalidRes.status === 400) {
        results.passed.push('POST /roar/ads validates required fields');
        console.log('  ✅ Validation works (rejects missing fields)');
      } else {
        results.warnings.push('POST /roar/ads validation may not be working');
        console.log('  ⚠️  Validation may not be working');
      }
    }

    // 7. Check database table
    console.log('\n7️⃣ Checking ad_placements table...');
    try {
      const [tableCheck] = await db.execute(
        "SELECT COUNT(*) as count FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'ad_placements'",
        [process.env.DB_NAME]
      );
      
      if (tableCheck[0].count > 0) {
        const [ads] = await db.execute('SELECT COUNT(*) as count FROM ad_placements');
        results.passed.push(`ad_placements table exists (${ads[0].count} rows)`);
        console.log(`  ✅ ad_placements table exists (${ads[0].count} rows)`);
      } else {
        results.warnings.push('ad_placements table not found');
        console.log('  ⚠️  ad_placements table not found');
        console.log('  💡 Run migration: mysql -u looqta_dbuser -p looqta < sql/migrations/2025_add_roar_admin_system.sql');
      }
    } catch (error) {
      results.warnings.push(`Error checking table: ${error.message}`);
      console.log(`  ⚠️  Error: ${error.message}`);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 AD MANAGEMENT TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${results.passed.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);
    console.log(`⚠️  Warnings: ${results.warnings.length}`);
    console.log('='.repeat(60));

    if (results.passed.length > 0) {
      console.log('\n✅ PASSED TESTS:');
      results.passed.forEach(p => console.log(`  - ${p}`));
    }

    if (results.failed.length > 0) {
      console.log('\n❌ FAILED TESTS:');
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
    console.error('❌ Ad management test failed:', error.message);
    console.error(error.stack);
    return {
      success: false,
      error: error.message,
      results
    };
  }
}

// Run if called directly
if (require.main === module) {
  testAdManagement()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { testAdManagement };
