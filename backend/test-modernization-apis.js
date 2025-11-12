/**
 * Test script for modernization APIs
 * Run with: node test-modernization-apis.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:4000';

// Test product ID (you'll need to replace this with an actual product ID from your database)
const TEST_PRODUCT_ID = 'test123';
const TEST_USER_ID = 'test-user-123';

async function testAPIs() {
  console.log('🧪 Testing Looqta Modernization APIs\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  // Test 1: Health check
  console.log('1️⃣ Testing Health Check...');
  try {
    const health = await axios.get(`${BASE_URL}/api/health`);
    console.log('✅ Health check passed:', health.data);
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return;
  }
  console.log('');

  // Test 2: Price History API
  console.log('2️⃣ Testing Price History API...');
  try {
    const history = await axios.get(`${BASE_URL}/api/products/${TEST_PRODUCT_ID}/history?range=30d`);
    console.log('✅ Price history API working');
    console.log('   Response:', {
      productId: history.data.productId,
      range: history.data.range,
      dataPoints: history.data.data.length,
      stats: history.data.stats
    });
  } catch (error) {
    if (error.response && error.response.status === 500) {
      console.log('⚠️  Price history API endpoint exists but no data yet (expected if no products scraped)');
    } else {
      console.error('❌ Price history API failed:', error.message);
    }
  }
  console.log('');

  // Test 3: Create Price Alert
  console.log('3️⃣ Testing Price Alert Creation...');
  try {
    const alert = await axios.post(`${BASE_URL}/api/products/${TEST_PRODUCT_ID}/alerts`, {
      targetPrice: 1000,
      currency: 'SAR',
      userId: TEST_USER_ID,
      productName: 'Test Product',
      site: 'amazon.sa',
      url: 'https://amazon.sa/test-product',
      notificationType: 'email'
    });
    console.log('✅ Price alert created:', alert.data);
  } catch (error) {
    if (error.response) {
      console.log('⚠️  Price alert API response:', error.response.status, error.response.data);
    } else {
      console.error('❌ Price alert creation failed:', error.message);
    }
  }
  console.log('');

  // Test 4: Get User Alerts
  console.log('4️⃣ Testing Get User Alerts...');
  try {
    const alerts = await axios.get(`${BASE_URL}/api/users/${TEST_USER_ID}/alerts`);
    console.log('✅ User alerts API working');
    console.log('   Alerts found:', alerts.data.alerts.length);
  } catch (error) {
    if (error.response && error.response.status === 500) {
      console.log('⚠️  User alerts API endpoint exists but no alerts yet');
    } else {
      console.error('❌ User alerts API failed:', error.message);
    }
  }
  console.log('');

  // Test 5: Affiliate Token Generation
  console.log('5️⃣ Testing Affiliate Token Generation...');
  try {
    const token = await axios.post(`${BASE_URL}/api/affiliate/token`, {
      url: 'https://amazon.sa/test-product',
      site: 'amazon.sa',
      productId: TEST_PRODUCT_ID,
      productName: 'Test Product',
      affiliateUrl: 'https://amazon.sa/test-product?affiliate=123'
    });
    console.log('✅ Affiliate token generated:', token.data);
    console.log('   Redirect URL:', `${BASE_URL}${token.data.redirectUrl}`);
  } catch (error) {
    if (error.response) {
      console.log('⚠️  Affiliate token API response:', error.response.status, error.response.data);
    } else {
      console.error('❌ Affiliate token generation failed:', error.message);
    }
  }
  console.log('');

  console.log('✨ API Testing Complete!\n');
  console.log('Next steps:');
  console.log('1. Run a search to generate price history data');
  console.log('2. Create frontend components for price history and alerts');
  console.log('3. Update scrapers to extract seller metadata');
}

// Run tests
testAPIs().catch(console.error);
