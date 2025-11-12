#!/usr/bin/env node
/**
 * Comprehensive ROAR Validation and Fix Script
 * Checks services, restarts if needed, and validates all ROAR endpoints
 */

const http = require('http');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
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
      headers: options.headers || {},
      timeout: 5000
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

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

function checkPort(port) {
  try {
    const result = execSync(`lsof -i :${port} 2>/dev/null || ss -tlnp 2>/dev/null | grep :${port} || netstat -tlnp 2>/dev/null | grep :${port}`, { encoding: 'utf-8' });
    return result.trim().length > 0;
  } catch (e) {
    return false;
  }
}

function checkPM2() {
  try {
    const result = execSync('pm2 list 2>/dev/null', { encoding: 'utf-8' });
    return result.includes('looqta-backend') || result.includes('looqta-frontend');
  } catch (e) {
    return false;
  }
}

async function checkBackendRunning() {
  log('\n🔍 Checking Backend Service...', 'blue');
  try {
    const response = await makeRequest('http://localhost:4000/api/health');
    if (response.status === 200) {
      log('✅ Backend is running on port 4000', 'green');
      return true;
    }
  } catch (error) {
    log('❌ Backend is not responding on port 4000', 'red');
    log(`   Error: ${error.message}`, 'yellow');
    return false;
  }
  return false;
}

async function checkFrontendRunning() {
  log('\n🔍 Checking Frontend Service...', 'blue');
  try {
    const response = await makeRequest('http://localhost:3000/');
    if (response.status === 200) {
      log('✅ Frontend is running on port 3000', 'green');
      return true;
    }
  } catch (error) {
    log('❌ Frontend is not responding on port 3000', 'red');
    log(`   Error: ${error.message}`, 'yellow');
    return false;
  }
  return false;
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
        log(`   Available endpoints: ${Object.keys(data.endpoints || {}).join(', ')}`, 'cyan');
        return true;
      } else {
        log('⚠️  Backend /roar returned 200 but unexpected format', 'yellow');
        log(`   Response: ${response.body.substring(0, 100)}`, 'yellow');
        return false;
      }
    } else {
      log(`❌ Backend /roar returned status ${response.status}`, 'red');
      if (response.status === 404) {
        log('   ⚠️  Backend needs restart to load new GET /roar route!', 'yellow');
      }
      return false;
    }
  } catch (error) {
    log(`❌ Backend /roar failed: ${error.message}`, 'red');
    return false;
  }
}

async function validateFrontendRoar() {
  log('\n🔍 Testing Frontend /roar page...', 'blue');
  try {
    const response = await makeRequest('http://localhost:3000/roar');
    if (response.status === 200) {
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

function checkRouteExists() {
  log('\n🔍 Checking if GET /roar route exists in code...', 'blue');
  const roarRouteFile = path.join(__dirname, 'backend/src/routes/roar.js');
  if (!fs.existsSync(roarRouteFile)) {
    log('❌ roar.js route file not found!', 'red');
    return false;
  }
  
  const content = fs.readFileSync(roarRouteFile, 'utf-8');
  if (content.includes("router.get('/',") && content.includes('ROAR Admin API is running')) {
    log('✅ GET /roar route exists in code', 'green');
    return true;
  } else {
    log('❌ GET /roar route NOT found in code!', 'red');
    log('   Route needs to be added to backend/src/routes/roar.js', 'yellow');
    return false;
  }
}

function suggestRestart() {
  log('\n💡 RESTART INSTRUCTIONS:', 'cyan');
  log('='.repeat(60), 'cyan');
  
  if (checkPM2()) {
    log('Using PM2:', 'yellow');
    log('  pm2 restart looqta-backend', 'cyan');
    log('  pm2 restart looqta-frontend', 'cyan');
  } else {
    log('Manual restart:', 'yellow');
    log('  Backend:', 'cyan');
    log('    cd /opt/looqta/backend', 'cyan');
    log('    pkill -f "node.*src/index.js"', 'cyan');
    log('    npm start', 'cyan');
    log('  Frontend:', 'cyan');
    log('    cd /opt/looqta/frontend', 'cyan');
    log('    pkill -f "next.*start"', 'cyan');
    log('    npm run build', 'cyan');
    log('    npm start', 'cyan');
  }
  log('='.repeat(60), 'cyan');
}

async function main() {
  log('='.repeat(60), 'blue');
  log('ROAR 404 Fix - Comprehensive Validation', 'blue');
  log('='.repeat(60), 'blue');

  const results = {
    routeExists: checkRouteExists(),
    backendRunning: await checkBackendRunning(),
    frontendRunning: await checkFrontendRunning(),
    backendRoar: false,
    frontendRoar: false,
    backendAuth: false
  };

  // Only test endpoints if services are running
  if (results.backendRunning) {
    results.backendRoar = await validateBackendRoar();
    results.backendAuth = await validateBackendAuthEndpoint();
  } else {
    log('\n⚠️  Skipping backend endpoint tests (backend not running)', 'yellow');
  }

  if (results.frontendRunning) {
    results.frontendRoar = await validateFrontendRoar();
  } else {
    log('\n⚠️  Skipping frontend endpoint tests (frontend not running)', 'yellow');
  }

  // Summary
  log('\n' + '='.repeat(60), 'blue');
  log('VALIDATION SUMMARY', 'blue');
  log('='.repeat(60), 'blue');
  
  log(`GET /roar route in code: ${results.routeExists ? '✅ PASS' : '❌ FAIL'}`, results.routeExists ? 'green' : 'red');
  log(`Backend service running: ${results.backendRunning ? '✅ PASS' : '❌ FAIL'}`, results.backendRunning ? 'green' : 'red');
  log(`Frontend service running: ${results.frontendRunning ? '✅ PASS' : '❌ FAIL'}`, results.frontendRunning ? 'green' : 'red');
  
  if (results.backendRunning) {
    log(`Backend /roar endpoint: ${results.backendRoar ? '✅ PASS' : '❌ FAIL'}`, results.backendRoar ? 'green' : 'red');
    log(`Backend /roar/auth/login: ${results.backendAuth ? '✅ PASS' : '❌ FAIL'}`, results.backendAuth ? 'green' : 'red');
  }
  
  if (results.frontendRunning) {
    log(`Frontend /roar page: ${results.frontendRoar ? '✅ PASS' : '❌ FAIL'}`, results.frontendRoar ? 'green' : 'red');
  }

  log('='.repeat(60), 'blue');

  // Recommendations
  if (!results.routeExists) {
    log('\n❌ CRITICAL: GET /roar route missing from code!', 'red');
    log('   The route needs to be added to backend/src/routes/roar.js', 'yellow');
  }

  if (results.routeExists && !results.backendRoar && results.backendRunning) {
    log('\n⚠️  Backend route exists in code but returns 404', 'yellow');
    log('   Backend needs to be restarted to load the new route!', 'yellow');
    suggestRestart();
  }

  if (!results.backendRunning) {
    log('\n⚠️  Backend is not running', 'yellow');
    log('   Start backend: cd backend && npm start', 'yellow');
    suggestRestart();
  }

  if (!results.frontendRunning) {
    log('\n⚠️  Frontend is not running', 'yellow');
    log('   Start frontend: cd frontend && npm run build && npm start', 'yellow');
    suggestRestart();
  }

  const allPassed = Object.values(results).every(r => r === true);
  
  if (allPassed) {
    log('\n🎉 All validations passed! ROAR is working correctly.', 'green');
    process.exit(0);
  } else {
    log('\n⚠️  Some validations failed. Please follow the instructions above.', 'yellow');
    process.exit(1);
  }
}

main().catch((error) => {
  log(`\n❌ Validation script error: ${error.message}`, 'red');
  log(error.stack, 'red');
  process.exit(1);
});
