const request = require('supertest');
const express = require('express');
const searchRouter = require('../src/routes/search');
const cache = require('../src/cache/redis');

// mock redis to avoid dependency
jest.mock('../src/cache/redis', () => ({
  get: jest.fn(),
  set: jest.fn(),
}));

const app = express();
app.use('/api/search', searchRouter);

test('400 when query missing', async () => {
  const res = await request(app).get('/api/search');
  expect(res.status).toBe(400);
  expect(res.body.error).toBeDefined();
});

test('valid query returns JSON', async () => {
  cache.get.mockResolvedValue(null);
  cache.set.mockResolvedValue(true);
  const res = await request(app).get('/api/search').query({ q: 'GoPro Hero 13 Black' });
  expect(res.status).toBe(200);
  expect(res.body.data).toBeDefined();
  expect(Array.isArray(res.body.data)).toBe(true);
});
