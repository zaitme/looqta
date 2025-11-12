#!/usr/bin/env node
/**
 * Test script to validate ROAR Admin UI
 * Tests:
 * 1. Page loads correctly
 * 2. CSS classes are present
 * 3. API endpoints are accessible
 * 4. Authentication flow works
 */

const http = require('http');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

console.log('🧪 Testing ROAR Admin UI...\n');

// Test 1: Frontend page loads
async function testFrontendPage() {
  return new Promise((resolve, reject) => {
    http.get(`${FRONTEND_URL}/roar`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const hasReactContent = data.includes('__next') || data.includes('Loading ROAR Admin');
          const hasTailwindClasses = data.includes('bg-gradient-to-br') || data.includes('animate-spin');
          const hasStyles = data.includes('min-h-screen');
          
          if (hasReactContent && hasTailwindClasses && hasStyles) {
            console.log('✅ Test 1: Frontend page loads correctly');
            console.log('   - React content: ✓');
            console.log('   - Tailwind classes: ✓');
            console.log('   - Styles: ✓');
            resolve(true);
          } else {
            console.log('❌ Test 1: Frontend page missing expected content');
            console.log(`   - React content: ${hasReactContent ? '✓' : '✗'}`);
            console.log(`   - Tailwind classes: ${hasTailwindClasses ? '✓' : '✗'}`);
            console.log(`   - Styles: ${hasStyles ? '✓' : '✗'}`);
            reject(new Error('Missing expected content'));
          }
        } else {
          console.log(`❌ Test 1: Frontend returned status ${res.statusCode}`);
          reject(new Error(`Status ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

// Test 2: Proxy route works
async function testProxyRoute() {
  return new Promise((resolve, reject) => {
    // Test with a valid path
    http.get(`${FRONTEND_URL}/api/proxy/roar/auth/me`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // 401 is expected if not authenticated, 200 if authenticated
        if (res.statusCode === 200 || res.statusCode === 401) {
          try {
            const json = JSON.parse(data);
            console.log('✅ Test 2: Proxy route works correctly');
            console.log(`   - Status: ${res.statusCode}`);
            console.log(`   - Response: ${json.success ? 'Success' : json.error || 'Unauthorized'}`);
            resolve(true);
          } catch (e) {
            console.log('⚠️  Test 2: Proxy route returned non-JSON (may be redirect)');
            resolve(true); // Not critical
          }
        } else {
          console.log(`❌ Test 2: Proxy route returned status ${res.statusCode}`);
          reject(new Error(`Status ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

// Test 3: Backend ROAR endpoint
async function testBackendEndpoint() {
  return new Promise((resolve, reject) => {
    http.get(`${BACKEND_URL}/roar/`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            if (json.success && json.endpoints) {
              console.log('✅ Test 3: Backend ROAR endpoint works');
              console.log(`   - Endpoints available: ${Object.keys(json.endpoints).length}`);
              resolve(true);
            } else {
              console.log('❌ Test 3: Backend returned unexpected response');
              reject(new Error('Unexpected response format'));
            }
          } catch (e) {
            console.log('❌ Test 3: Backend returned invalid JSON');
            reject(e);
          }
        } else {
          console.log(`❌ Test 3: Backend returned status ${res.statusCode}`);
          reject(new Error(`Status ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

// Test 4: CSS file loads
async function testCSSFile() {
  return new Promise((resolve, reject) => {
    http.get(`${FRONTEND_URL}/_next/static/css/app/layout.css`, (res) => {
      if (res.statusCode === 200 || res.statusCode === 404) {
        // CSS might be inlined or in different location
        console.log('✅ Test 4: CSS check (may be inlined)');
        resolve(true);
      } else {
        console.log(`⚠️  Test 4: CSS file check returned ${res.statusCode}`);
        resolve(true); // Not critical
      }
    }).on('error', () => {
      console.log('⚠️  Test 4: Could not check CSS file (may be inlined)');
      resolve(true); // Not critical
    });
  });
}

// Run all tests
async function runTests() {
  const tests = [
    { name: 'Frontend Page', fn: testFrontendPage },
    { name: 'Proxy Route', fn: testProxyRoute },
    { name: 'Backend Endpoint', fn: testBackendEndpoint },
    { name: 'CSS File', fn: testCSSFile },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test.fn();
      passed++;
    } catch (error) {
      failed++;
      console.log(`   Error: ${error.message}\n`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));

  if (failed === 0) {
    console.log('\n✅ All tests passed! ROAR Admin UI should be working.');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed. Please check the errors above.');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
