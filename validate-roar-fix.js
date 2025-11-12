#!/usr/bin/env node
/**
 * Validation script for ROAR 404 fix
 * Tests that:
 * 1. Backend /roar endpoint returns 200
 * 2. Frontend /roar page is accessible
 * 3. Backend API endpoints are working
 */

const http = require('http');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

async function validateBackendRoar() {
  log('\n🔍 Testing Backend /roar endpoint...', 'blue');
  try {
    const response = await makeRequest('http://localhost:4000/roar');
    if (response.status === 200) {
      const data = JSON.parse(response.body);
      if (data.success && data.message) {
        log('✅ Backend /roar endpoint is working', 'green');
        log(`   Message: ${data.message}`, 'green');
        return true;
      } else {
        log('⚠️  Backend /roar returned 200 but unexpected format', 'yellow');
        return false;
      }
    } else {
      log(`❌ Backend /roar returned status ${response.status}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Backend /roar failed: ${error.message}`, 'red');
    log('   Make sure backend is running on port 4000', 'yellow');
    return false;
  }
}

async function validateFrontendRoar() {
  log('\n🔍 Testing Frontend /roar page...', 'blue');
  try {
    const response = await makeRequest('http://localhost:3000/roar');
    if (response.status === 200) {
      // Check if it's HTML (Next.js page)
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        log('✅ Frontend /roar page is accessible', 'green');
        return true;
      } else {
        log(`⚠️  Frontend /roar returned unexpected content type: ${contentType}`, 'yellow');
        return false;
      }
    } else {
      log(`❌ Frontend /roar returned status ${response.status}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Frontend /roar failed: ${error.message}`, 'red');
    log('   Make sure frontend is running on port 3000', 'yellow');
    log('   Try: cd frontend && npm run start', 'yellow');
    return false;
  }
}

async function validateBackendAuthEndpoint() {
  log('\n🔍 Testing Backend /roar/auth/login endpoint...', 'blue');
  try {
    const response = await makeRequest('http://localhost:4000/roar/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test', password: 'test' })
    });
    
    // Should return 401 (unauthorized) or 400 (bad request), not 404
    if (response.status === 404) {
      log('❌ Backend /roar/auth/login returned 404 (endpoint not found)', 'red');
      return false;
    } else if (response.status === 400 || response.status === 401) {
      log('✅ Backend /roar/auth/login endpoint exists (returned expected error)', 'green');
      return true;
    } else {
      log(`⚠️  Backend /roar/auth/login returned unexpected status ${response.status}`, 'yellow');
      return false;
    }
  } catch (error) {
    log(`❌ Backend /roar/auth/login failed: ${error.message}`, 'red');
    return false;
  }
}

async function main() {
  log('='.repeat(60), 'blue');
  log('ROAR 404 Fix Validation', 'blue');
  log('='.repeat(60), 'blue');

  const results = {
    backendRoar: await validateBackendRoar(),
    frontendRoar: await validateFrontendRoar(),
    backendAuth: await validateBackendAuthEndpoint()
  };

  log('\n' + '='.repeat(60), 'blue');
  log('Validation Summary', 'blue');
  log('='.repeat(60), 'blue');
  
  log(`Backend /roar endpoint: ${results.backendRoar ? '✅ PASS' : '❌ FAIL'}`, results.backendRoar ? 'green' : 'red');
  log(`Frontend /roar page: ${results.frontendRoar ? '✅ PASS' : '❌ FAIL'}`, results.frontendRoar ? 'green' : 'red');
  log(`Backend /roar/auth/login: ${results.backendAuth ? '✅ PASS' : '❌ FAIL'}`, results.backendAuth ? 'green' : 'red');

  const allPassed = Object.values(results).every(r => r === true);
  
  if (allPassed) {
    log('\n🎉 All validations passed!', 'green');
    process.exit(0);
  } else {
    log('\n⚠️  Some validations failed. Please check the errors above.', 'yellow');
    process.exit(1);
  }
}

main().catch((error) => {
  log(`\n❌ Validation script error: ${error.message}`, 'red');
  process.exit(1);
});
