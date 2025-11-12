/**
 * Admin Scraper Status Endpoints
 * Implements monitoring and health checks for scraper system
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const db = require('../db/mysql');
const cache = require('../cache/redis');
const jobQueue = require('../utils/job-queue');
const { 
  getProductsForScraping,
  updateTiers 
} = require('../utils/product-metrics');

/**
 * GET /admin/scraper/status
 * Get overall scraper system status
 */
router.get('/status', async (req, res) => {
  try {
    // Get job queue stats
    const queueStats = jobQueue.getStats();
    
    // Get cache status
    let cacheStatus = 'unknown';
    try {
      await cache.ping();
      cacheStatus = 'connected';
    } catch (e) {
      cacheStatus = 'disconnected';
    }
    
    // Get database status
    let dbStatus = 'unknown';
    let productCount = 0;
    let validProductCount = 0;
    try {
      await db.execute('SELECT 1');
      dbStatus = 'connected';
      
      const [products] = await db.execute('SELECT COUNT(*) as count FROM products');
      const [validProducts] = await db.execute('SELECT COUNT(*) as count FROM products WHERE is_valid = TRUE');
      productCount = products[0]?.count || 0;
      validProductCount = validProducts[0]?.count || 0;
    } catch (e) {
      dbStatus = 'disconnected';
    }
    
    // Get metrics stats
    let metricsStats = null;
    try {
      const [tierCounts] = await db.execute(
        `SELECT tier, COUNT(*) as count FROM product_metrics GROUP BY tier`
      );
      metricsStats = tierCounts;
    } catch (e) {
      // Metrics table might not exist yet
    }
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      components: {
        cache: {
          status: cacheStatus
        },
        database: {
          status: dbStatus,
          productCount,
          validProductCount
        },
        jobQueue: queueStats,
        metrics: {
          tierCounts: metricsStats
        }
      }
    });
    
  } catch (error) {
    logger.error('Failed to get scraper status', { error: error.message });
    res.status(500).json({ error: 'Failed to get status' });
  }
});

/**
 * GET /admin/scraper/queue
 * Get job queue details
 */
router.get('/queue', async (req, res) => {
  try {
    const stats = jobQueue.getStats();
    res.json({
      ...stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get queue stats', { error: error.message });
    res.status(500).json({ error: 'Failed to get queue stats' });
  }
});

/**
 * GET /admin/scraper/metrics
 * Get product metrics summary
 */
router.get('/metrics', async (req, res) => {
  try {
    // Get tier distribution
    const [tierCounts] = await db.execute(
      `SELECT tier, COUNT(*) as count FROM product_metrics GROUP BY tier`
    );
    
    // Get top searched products
    const [topSearched] = await db.execute(
      `SELECT product_id, search_count_week, last_scraped_at, tier
       FROM product_metrics
       ORDER BY search_count_week DESC
       LIMIT 20`
    );
    
    // Get scraping backlog
    const hotBacklog = await getProductsForScraping('HOT', 1, 100);
    const warmBacklog = await getProductsForScraping('WARM', 4, 100);
    const coldBacklog = await getProductsForScraping('COLD', 24, 100);
    
    res.json({
      tierDistribution: tierCounts,
      topSearched: topSearched,
      backlog: {
        hot: hotBacklog.length,
        warm: warmBacklog.length,
        cold: coldBacklog.length
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get metrics', { error: error.message });
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

/**
 * POST /admin/scraper/tiers/update
 * Manually trigger tier update
 */
router.post('/tiers/update', async (req, res) => {
  try {
    const result = await updateTiers();
    res.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to update tiers', { error: error.message });
    res.status(500).json({ error: 'Failed to update tiers' });
  }
});

/**
 * GET /admin/scraper/products/:tier
 * Get products for a specific tier
 */
router.get('/products/:tier', async (req, res) => {
  try {
    const { tier } = req.params;
    const intervalHours = tier === 'HOT' ? 1 : tier === 'WARM' ? 4 : 24;
    const limit = parseInt(req.query.limit) || 50;
    
    const products = await getProductsForScraping(tier.toUpperCase(), intervalHours, limit);
    
    res.json({
      tier: tier.toUpperCase(),
      count: products.length,
      products,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get products for tier', { error: error.message });
    res.status(500).json({ error: 'Failed to get products' });
  }
});

module.exports = router;
