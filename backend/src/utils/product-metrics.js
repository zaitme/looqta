/**
 * Product Metrics Collection System
 * Implements PHASE 3: High-Efficiency Cron Strategy
 * 
 * Tracks search counts, last scraped times, and tier assignments
 */

const db = require('../db/mysql');
const cache = require('../cache/redis');
const logger = require('./logger');

/**
 * Increment search count for a product (Redis counter)
 * @param {string} productId - Product ID
 */
async function incrementSearchCount(productId) {
  if (!productId) return;
  
  try {
    const key = `metrics:search_count:${productId}`;
    await cache.client.incr(key);
    // Set expiry to 7 days (weekly counter)
    await cache.client.expire(key, 7 * 24 * 60 * 60);
  } catch (error) {
    logger.warn('Failed to increment search count', { productId, error: error.message });
  }
}

/**
 * Increment search count for multiple products
 */
async function incrementSearchCounts(productIds) {
  if (!Array.isArray(productIds) || productIds.length === 0) return;
  
  const pipeline = cache.client.pipeline();
  productIds.forEach(productId => {
    if (productId) {
      const key = `metrics:search_count:${productId}`;
      pipeline.incr(key);
      pipeline.expire(key, 7 * 24 * 60 * 60);
    }
  });
  
  try {
    await pipeline.exec();
  } catch (error) {
    logger.warn('Failed to increment search counts', { error: error.message });
  }
}

/**
 * Flush Redis counters to MySQL (periodic batch update)
 * Should be called by cron job (e.g., every hour)
 */
async function flushMetricsToDatabase() {
  try {
    // Get all search count keys
    const keys = await cache.keys('metrics:search_count:*');
    
    if (keys.length === 0) {
      logger.debug('No metrics to flush');
      return { flushed: 0 };
    }
    
    const updates = [];
    const pipeline = cache.client.pipeline();
    
    // Get all counts and delete keys
    for (const key of keys) {
      const productId = key.replace('metrics:search_count:', '');
      pipeline.get(key);
      pipeline.del(key);
    }
    
    const results = await pipeline.exec();
    
    // Process results (every other result is the count, followed by del result)
    for (let i = 0; i < results.length; i += 2) {
      const [getError, count] = results[i];
      const [delError] = results[i + 1];
      
      if (!getError && count && parseInt(count) > 0) {
        const key = keys[Math.floor(i / 2)];
        const productId = key.replace('metrics:search_count:', '');
        updates.push({
          productId,
          searchCount: parseInt(count)
        });
      }
    }
    
    if (updates.length === 0) {
      return { flushed: 0 };
    }
    
    // Batch update MySQL
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      
      for (const update of updates) {
        // Upsert product_metrics
        await connection.execute(
          `INSERT INTO product_metrics (product_id, search_count_week, updated_at)
           VALUES (?, ?, NOW())
           ON DUPLICATE KEY UPDATE
             search_count_week = search_count_week + ?,
             updated_at = NOW()`,
          [update.productId, update.searchCount, update.searchCount]
        );
      }
      
      await connection.commit();
      
      logger.info('Metrics flushed to database', { flushed: updates.length });
      return { flushed: updates.length };
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    
  } catch (error) {
    logger.error('Failed to flush metrics to database', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Update last_scraped_at for a product
 */
async function updateLastScrapedAt(productId) {
  if (!productId) return;
  
  try {
    await db.execute(
      `INSERT INTO product_metrics (product_id, last_scraped_at, updated_at)
       VALUES (?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         last_scraped_at = NOW(),
         updated_at = NOW()`,
      [productId]
    );
  } catch (error) {
    logger.warn('Failed to update last_scraped_at', { productId, error: error.message });
  }
}

/**
 * Calculate and update tier for all products
 * HOT: Top 1% by search_count_week OR is_tracked = true
 * WARM: Next 10-20%
 * COLD: All others
 */
async function updateTiers() {
  try {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Get total count
      const [totalResult] = await connection.execute(
        `SELECT COUNT(*) as total FROM product_metrics`
      );
      const total = totalResult[0]?.total || 0;
      
      if (total === 0) {
        await connection.commit();
        return { updated: 0 };
      }
      
      // Set all to COLD first
      await connection.execute(
        `UPDATE product_metrics SET tier = 'COLD'`
      );
      
      // Set HOT: Top 1% OR is_tracked = true
      const hotLimit = Math.max(1, Math.floor(total * 0.01));
      await connection.execute(
        `UPDATE product_metrics
         SET tier = 'HOT'
         WHERE is_tracked = TRUE
            OR product_id IN (
              SELECT product_id FROM (
                SELECT product_id
                FROM product_metrics
                ORDER BY search_count_week DESC, last_scraped_at DESC
                LIMIT ?
              ) AS hot_products
            )`,
        [hotLimit]
      );
      
      // Set WARM: Next 10-20% (excluding HOT)
      const warmLimit = Math.max(1, Math.floor(total * 0.20));
      await connection.execute(
        `UPDATE product_metrics
         SET tier = 'WARM'
         WHERE tier = 'COLD'
           AND product_id IN (
             SELECT product_id FROM (
               SELECT product_id
               FROM product_metrics
               WHERE tier = 'COLD'
               ORDER BY search_count_week DESC, last_scraped_at DESC
               LIMIT ?
             ) AS warm_products
           )`,
        [warmLimit]
      );
      
      await connection.commit();
      
      // Get counts
      const [tierCounts] = await connection.execute(
        `SELECT tier, COUNT(*) as count FROM product_metrics GROUP BY tier`
      );
      
      logger.info('Tiers updated', { tierCounts });
      
      return { updated: total, tierCounts };
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    
  } catch (error) {
    logger.error('Failed to update tiers', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Get products that need scraping based on tier
 * @param {string} tier - 'HOT', 'WARM', 'COLD'
 * @param {number} intervalHours - Hours since last scrape
 * @param {number} limit - Max products to return
 */
async function getProductsForScraping(tier, intervalHours, limit = 100) {
  try {
    const [rows] = await db.execute(
      `SELECT pm.product_id, p.site, p.site_product_id, COALESCE(p.affiliate_url, p.url) as url
       FROM product_metrics pm
       LEFT JOIN products p ON pm.product_id = p.product_id
       WHERE pm.tier = ?
         AND (pm.last_scraped_at IS NULL 
           OR pm.last_scraped_at <= DATE_SUB(NOW(), INTERVAL ? HOUR))
         AND p.is_valid = TRUE
       ORDER BY pm.search_count_week DESC, pm.last_scraped_at ASC
       LIMIT ?`,
      [tier, intervalHours, limit]
    );
    
    return rows;
  } catch (error) {
    logger.error('Failed to get products for scraping', {
      tier,
      error: error.message
    });
    return [];
  }
}

/**
 * Mark product as tracked (for manual tracking)
 */
async function setTracked(productId, isTracked = true) {
  try {
    await db.execute(
      `INSERT INTO product_metrics (product_id, is_tracked, updated_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         is_tracked = ?,
         updated_at = NOW()`,
      [productId, isTracked, isTracked]
    );
    
    // Update tier if tracked (should be HOT)
    if (isTracked) {
      await db.execute(
        `UPDATE product_metrics SET tier = 'HOT' WHERE product_id = ?`,
        [productId]
      );
    }
  } catch (error) {
    logger.error('Failed to set tracked status', { productId, error: error.message });
    throw error;
  }
}

module.exports = {
  incrementSearchCount,
  incrementSearchCounts,
  flushMetricsToDatabase,
  updateLastScrapedAt,
  updateTiers,
  getProductsForScraping,
  setTracked
};
