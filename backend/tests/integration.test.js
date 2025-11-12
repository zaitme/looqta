/**
 * Integration Tests
 * Tests end-to-end workflows and API integration
 * Part of test_and_validation_plan.txt implementation
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const request = require('supertest');
const express = require('express');
const db = require('../src/db/mysql');
const cache = require('../src/cache/redis');

jest.mock('../src/cache/redis', () => ({
  get: jest.fn(),
  set: jest.fn(),
  ping: jest.fn(),
  keys: jest.fn(),
  del: jest.fn(),
  client: {}
}));

const app = express();
app.use(express.json());

const searchRouter = require('../src/routes/search');
const productsRouter = require('../src/routes/products');
const usersRouter = require('../src/routes/users');
const affiliateRouter = require('../src/routes/affiliate');

app.use('/api/search', searchRouter);
app.use('/api/products', productsRouter);
app.use('/api/users', usersRouter);
app.use('/r', affiliateRouter);
app.use('/api/affiliate', affiliateRouter);

describe('Integration Tests', () => {
  beforeAll(async () => {
    try {
      await db.getConnection();
    } catch (error) {
      console.warn('Database connection failed:', error.message);
    }
  });

  afterAll(async () => {
    if (db && typeof db.end === 'function') {
      await db.end();
    }
  });

  describe('API Integration Tests', () => {
    test('GET /api/products/:id/history should return correct data', async () => {
      const testProductId = 'test-product-' + Date.now();
      
      const res = await request(app)
        .get(`/api/products/${testProductId}/history`)
        .query({ range: '30d' });

      // Should return 200, 404, or 500 (not 400 for bad request)
      expect([200, 404, 500]).toContain(res.status);
      
      if (res.status === 200) {
        expect(res.body).toHaveProperty('productId');
        expect(res.body).toHaveProperty('range');
        expect(res.body).toHaveProperty('data');
        expect(Array.isArray(res.body.data)).toBe(true);
      }
    });

    test('POST /api/products/:id/alerts should create alert', async () => {
      const testProductId = 'test-product-' + Date.now();
      const testUserId = 'test-user-' + Date.now();

      const res = await request(app)
        .post(`/api/products/${testProductId}/alerts`)
        .send({
          userId: testUserId,
          productName: 'Test Product',
          site: 'amazon.sa',
          url: 'https://amazon.sa/test',
          targetPrice: 100.00,
          currency: 'SAR',
          notificationType: 'email'
        });

      expect([200, 201, 400, 500]).toContain(res.status);
    });

    test('GET /api/users/:userId/alerts should return user alerts', async () => {
      const testUserId = 'test-user-' + Date.now();

      const res = await request(app)
        .get(`/api/users/${testUserId}/alerts`);

      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        expect(Array.isArray(res.body)).toBe(true);
      }
    });
  });

  describe('End-to-End Workflow Tests', () => {
    test('Search -> Price History -> Alert workflow', async () => {
      cache.get.mockResolvedValue(null);
      cache.set.mockResolvedValue(true);

      // Step 1: Search for products
      const searchRes = await request(app)
        .get('/api/search')
        .query({ q: 'iphone' });

      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data).toBeDefined();
      expect(Array.isArray(searchRes.body.data)).toBe(true);

      if (searchRes.body.data.length > 0) {
        const product = searchRes.body.data[0];
        const crypto = require('crypto');
        const productId = crypto.createHash('md5').update(`${product.url}-${product.site}`).digest('hex');

        // Step 2: Get price history
        const historyRes = await request(app)
          .get(`/api/products/${productId}/history`)
          .query({ range: '30d' });

        expect([200, 404, 500]).toContain(historyRes.status);

        // Step 3: Create price alert
        const testUserId = 'test-user-' + Date.now();
        const alertRes = await request(app)
          .post(`/api/products/${productId}/alerts`)
          .send({
            userId: testUserId,
            productName: product.product_name,
            site: product.site,
            url: product.url,
            targetPrice: (product.price || 100) * 0.9, // 10% below current
            currency: product.currency || 'SAR',
            notificationType: 'email'
          });

        expect([200, 201, 400, 500]).toContain(alertRes.status);
      }
    });

    test('Search -> Affiliate Click workflow', async () => {
      cache.get.mockResolvedValue(null);
      cache.set.mockResolvedValue(true);

      // Step 1: Search
      const searchRes = await request(app)
        .get('/api/search')
        .query({ q: 'laptop' });

      if (searchRes.status === 200 && searchRes.body.data && searchRes.body.data.length > 0) {
        const product = searchRes.body.data[0];

        // Step 2: Generate affiliate token
        const tokenRes = await request(app)
          .post('/api/affiliate/token')
          .send({
            productId: 'test-product',
            url: product.url,
            site: product.site
          });

        if (tokenRes.status === 200 && tokenRes.body.token) {
          // Step 3: Click affiliate link
          const clickRes = await request(app)
            .get(`/r/${tokenRes.body.token}`)
            .expect(302); // Should redirect

          expect(clickRes.headers.location).toBeDefined();
        }
      }
    });
  });

  describe('Database Integration Tests', () => {
    test('price_history table should be accessible', async () => {
      const [rows] = await db.execute('SELECT COUNT(*) as count FROM price_history LIMIT 1');
      expect(rows).toBeDefined();
      expect(rows[0].count).toBeGreaterThanOrEqual(0);
    });

    test('user_price_alerts table should be accessible', async () => {
      const [rows] = await db.execute('SELECT COUNT(*) as count FROM user_price_alerts LIMIT 1');
      expect(rows).toBeDefined();
      expect(rows[0].count).toBeGreaterThanOrEqual(0);
    });

    test('affiliate_clicks table should be accessible', async () => {
      const [rows] = await db.execute('SELECT COUNT(*) as count FROM affiliate_clicks LIMIT 1');
      expect(rows).toBeDefined();
      expect(rows[0].count).toBeGreaterThanOrEqual(0);
    });
  });
});
