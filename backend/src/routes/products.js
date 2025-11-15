/**
 * Product-related API routes
 * - Price history
 * - Price alerts
 * - Product details
 */
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const db = require('../db/mysql');
const crypto = require('crypto');

/**
 * Generate a unique product ID from URL and site
 */
function generateProductId(url, site) {
  if (!url || !site) return null;
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    const hash = crypto.createHash('md5').update(`${site}:${path}`).digest('hex').substring(0, 16);
    return hash;
  } catch (e) {
    return crypto.createHash('md5').update(`${site}:${url}`).digest('hex').substring(0, 16);
  }
}

/**
 * GET /api/products/:id/history
 * Get price history for a product
 */
router.get('/:id/history', async (req, res) => {
  try {
    const productId = req.params.id;
    const range = req.query.range || '30d'; // 7d, 30d, 90d, all
    
    // Check database connection
    try {
      await db.execute('SELECT 1');
    } catch (dbError) {
      logger.error('Database unavailable for price history', { error: dbError.message });
      return res.status(503).json({ 
        error: 'Service temporarily unavailable',
        message: 'Database connection unavailable'
      });
    }
    
    let dateFilter = '';
    if (range === '7d') {
      dateFilter = 'AND scraped_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
    } else if (range === '30d') {
      dateFilter = 'AND scraped_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    } else if (range === '90d') {
      dateFilter = 'AND scraped_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)';
    }
    
    const [rows] = await db.execute(
      `SELECT price, currency, source, scraped_at, site, url
       FROM price_history
       WHERE product_id = ?
       ${dateFilter}
       ORDER BY scraped_at DESC
       LIMIT 1000`,
      [productId]
    );
    
    // Calculate moving averages
    const prices = rows.map(r => parseFloat(r.price)).filter(p => !isNaN(p));
    const avg7d = prices.slice(0, 7).reduce((a, b) => a + b, 0) / Math.min(7, prices.length) || null;
    const avg30d = prices.slice(0, 30).reduce((a, b) => a + b, 0) / Math.min(30, prices.length) || null;
    
    const latestPrice = prices[0] || null;
    const oldestPrice = prices[prices.length - 1] || null;
    const percentChange = latestPrice && oldestPrice ? 
      ((latestPrice - oldestPrice) / oldestPrice * 100).toFixed(2) : null;
    
    res.json({
      productId,
      range,
      data: rows,
      stats: {
        count: rows.length,
        latestPrice,
        oldestPrice,
        avg7d: avg7d ? parseFloat(avg7d.toFixed(2)) : null,
        avg30d: avg30d ? parseFloat(avg30d.toFixed(2)) : null,
        percentChange: percentChange ? parseFloat(percentChange) : null
      }
    });
  } catch (error) {
    logger.error('Failed to get price history', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to retrieve price history' });
  }
});

/**
 * POST /api/products/:id/alerts
 * Create a price alert for a product
 */
router.post('/:id/alerts', async (req, res) => {
  try {
    const productId = req.params.id;
    const { targetPrice, currency = 'SAR', notificationType = 'email', userId, productName, site, url } = req.body;
    
    if (!targetPrice || !userId) {
      return res.status(400).json({ error: 'targetPrice and userId are required' });
    }
    
    // Check database connection
    try {
      await db.execute('SELECT 1');
    } catch (dbError) {
      logger.error('Database unavailable for alert creation', { error: dbError.message });
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }
    
    // Check if alert already exists
    const [existing] = await db.execute(
      `SELECT id FROM user_price_alerts 
       WHERE user_id = ? AND product_id = ? AND is_active = TRUE`,
      [userId, productId]
    );
    
    if (existing.length > 0) {
      // Update existing alert
      await db.execute(
        `UPDATE user_price_alerts 
         SET target_price = ?, currency = ?, notification_type = ?, updated_at = NOW()
         WHERE id = ?`,
        [targetPrice, currency, notificationType, existing[0].id]
      );
      return res.json({ message: 'Alert updated', alertId: existing[0].id });
    }
    
    // Create new alert
    const [result] = await db.execute(
      `INSERT INTO user_price_alerts 
       (user_id, product_id, product_name, site, url, target_price, currency, notification_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, productId, productName || null, site || null, url || null, targetPrice, currency, notificationType]
    );
    
    res.json({ message: 'Alert created', alertId: result.insertId });
  } catch (error) {
    logger.error('Failed to create price alert', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

/**
 * DELETE /api/products/:id/alerts/:alertId
 * Delete a price alert
 */
router.delete('/:id/alerts/:alertId', async (req, res) => {
  try {
    const alertId = parseInt(req.params.alertId);
    
    if (isNaN(alertId) || alertId <= 0) {
      return res.status(400).json({ error: 'Invalid alert ID' });
    }
    
    // Check database connection
    try {
      await db.execute('SELECT 1');
    } catch (dbError) {
      logger.error('Database unavailable for alert deletion', { error: dbError.message });
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }
    
    await db.execute(
      `UPDATE user_price_alerts SET is_active = FALSE WHERE id = ?`,
      [alertId]
    );
    res.json({ message: 'Alert deleted' });
  } catch (error) {
    logger.error('Failed to delete alert', { error: error.message });
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

/**
 * GET /api/products/:id
 * Get product details by product_id (hash)
 */
router.get('/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    
    // Check database connection
    try {
      await db.execute('SELECT 1');
    } catch (dbError) {
      logger.error('Database unavailable for product fetch', { error: dbError.message });
      return res.status(503).json({ 
        error: 'Service temporarily unavailable',
        message: 'Database connection unavailable'
      });
    }
    
    // Try to get product from products table
    const [productRows] = await db.execute(
      `SELECT 
        product_id,
        name as product_name,
        price,
        currency,
        url,
        image_url as image,
        affiliate_url,
        seller_rating,
        seller_rating_count,
        seller_type,
        site,
        site_product_id,
        source_sku,
        shipping_info,
        updated_at
      FROM products
      WHERE product_id = ?
      LIMIT 1`,
      [productId]
    );
    
    if (productRows.length > 0) {
      const product = productRows[0];
      // Parse shipping_info if it's a JSON string
      if (product.shipping_info && typeof product.shipping_info === 'string') {
        try {
          product.shipping_info = JSON.parse(product.shipping_info);
        } catch (e) {
          // Keep as string if parsing fails
        }
      }
      
      // Get latest price from price_history if available
      const [priceRows] = await db.execute(
        `SELECT price, currency, scraped_at
         FROM price_history
         WHERE product_id = ?
         ORDER BY scraped_at DESC
         LIMIT 1`,
        [productId]
      );
      
      if (priceRows.length > 0 && priceRows[0].price) {
        product.price = parseFloat(priceRows[0].price);
        product.currency = priceRows[0].currency || product.currency;
      }
      
      return res.json(product);
    }
    
    // If not found in products table, try to get from price_history
    const [historyRows] = await db.execute(
      `SELECT DISTINCT 
        product_id,
        site,
        url,
        price,
        currency,
        scraped_at
      FROM price_history
      WHERE product_id = ?
      ORDER BY scraped_at DESC
      LIMIT 1`,
      [productId]
    );
    
    if (historyRows.length > 0) {
      const history = historyRows[0];
      return res.json({
        product_id: history.product_id,
        site: history.site,
        url: history.url,
        price: parseFloat(history.price),
        currency: history.currency,
        product_name: null, // Not available from price_history
        image: null,
        updated_at: history.scraped_at
      });
    }
    
    // Product not found
    res.status(404).json({ 
      error: 'Product not found',
      productId 
    });
  } catch (error) {
    logger.error('Failed to get product', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to retrieve product' });
  }
});

module.exports = router;
