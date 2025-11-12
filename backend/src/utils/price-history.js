/**
 * Price history logging utility
 * Logs product prices to price_history table after scraping
 */
const db = require('../db/mysql');
const logger = require('./logger');
const crypto = require('crypto');

/**
 * Generate product ID from URL and site
 */
function generateProductId(url, site) {
  if (!url || !site) return null;
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    return crypto.createHash('md5').update(`${site}:${path}`).digest('hex').substring(0, 16);
  } catch (e) {
    return crypto.createHash('md5').update(`${site}:${url}`).digest('hex').substring(0, 16);
  }
}

/**
 * Log price history for products
 * @param {Array} products - Array of product objects with price, url, site, currency
 */
async function logPriceHistory(products) {
  if (!products || !Array.isArray(products) || products.length === 0) {
    return;
  }
  
  // Check database connection first
  try {
    await db.execute('SELECT 1');
  } catch (dbError) {
    logger.debug('Price history logging: Database unavailable, skipping', {
      error: dbError.message
    });
    return; // Exit gracefully if DB is unavailable
  }
  
  const insertPromises = products.map(async (product) => {
    try {
      const { price, url, site, currency = 'SAR', product_name } = product;
      
      if (!price || !url || !site) {
        return; // Skip invalid products
      }
      
      const productId = generateProductId(url, site);
      if (!productId) {
        return;
      }
      
      // Insert price history (ignore duplicates for same product_id and timestamp)
      await db.execute(
        `INSERT INTO price_history 
         (product_id, product_name, site, url, price, currency, source)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE price = VALUES(price)`,
        [productId, product_name || null, site, url, price, currency, site]
      );
      
      logger.debug('Price history logged', { productId, site, price, currency });
    } catch (error) {
      // Don't fail the entire operation if one product fails
      // Check if it's a connection error vs data error
      if (error.message && (error.message.includes('Access denied') || error.message.includes('ECONNREFUSED'))) {
        logger.debug('Price history logging: Database connection error, skipping', {
          error: error.message
        });
        return;
      }
      logger.warn('Failed to log price history for product', {
        error: error.message,
        product: product.product_name || 'unknown'
      });
    }
  });
  
  await Promise.allSettled(insertPromises);
  logger.info('Price history logging completed', { productCount: products.length });
}

module.exports = {
  logPriceHistory,
  generateProductId
};
