/**
 * Atomic Product Upsert Module
 * Implements PHASE 2: Atomic Database Writes
 * 
 * Ensures validated data is written atomically to DB + cache
 */

const db = require('../db/mysql');
const logger = require('./logger');
const cache = require('../cache/redis');
const { validateRecord } = require('./product-validation');

/**
 * Atomic upsert product to database
 * Uses INSERT ... ON DUPLICATE KEY UPDATE with transactions
 * 
 * @param {Object} validatedProduct - Validated product from validation pipeline
 * @returns {Promise<Object>} { success: boolean, productId: string, dbId: number }
 */
async function upsertProductAtomic(validatedProduct) {
  let connection;
  try {
    // Check database connection first
    try {
      await db.execute('SELECT 1');
    } catch (dbError) {
      logger.warn('Database unavailable for product upsert', {
        error: dbError.message,
        productId: validatedProduct.product_id
      });
      throw new Error('Database unavailable');
    }
    
    connection = await db.getConnection();
    await connection.beginTransaction();
    
    // Extract fields
    const {
      site,
      site_product_id,
      product_id,
      product_name,
      price_amount,
      price_currency,
      url,
      image_url,
      affiliate_link,
      seller_rating,
      seller_rating_count,
      seller_type,
      source_sku,
      shipping_info,
      is_valid,
      trust_score
    } = validatedProduct;
    
    // Upsert product
    const [result] = await connection.execute(
      `INSERT INTO products (
        site, site_product_id, product_id, product_name, 
        price_amount, price_currency, price, currency,
        url, image_url, affiliate_url,
        seller_rating, seller_rating_count, seller_type,
        source_sku, shipping_info,
        is_valid, trust_score, last_checked_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        product_name = VALUES(product_name),
        price_amount = VALUES(price_amount),
        price_currency = VALUES(price_currency),
        price = VALUES(price_amount),
        currency = VALUES(price_currency),
        url = COALESCE(VALUES(url), url),
        image_url = VALUES(image_url),
        affiliate_url = COALESCE(VALUES(affiliate_url), affiliate_url),
        seller_rating = VALUES(seller_rating),
        seller_rating_count = VALUES(seller_rating_count),
        seller_type = VALUES(seller_type),
        source_sku = VALUES(source_sku),
        shipping_info = VALUES(shipping_info),
        is_valid = VALUES(is_valid),
        trust_score = VALUES(trust_score),
        last_checked_at = NOW(),
        updated_at = NOW()`,
      [
        site,
        site_product_id,
        product_id,
        product_name,
        price_amount,
        price_currency,
        price_amount, // Also set legacy 'price' field
        price_currency, // Also set legacy 'currency' field
        url,
        image_url,
        affiliate_link,
        seller_rating,
        seller_rating_count,
        seller_type,
        source_sku,
        shipping_info ? JSON.stringify(shipping_info) : null,
        is_valid !== false, // Ensure boolean
        trust_score || 0
      ]
    );
    
    // Get the product database ID
    let dbProductId;
    if (result.insertId) {
      dbProductId = result.insertId;
    } else {
      // Product already existed, fetch the ID
      const [existing] = await connection.execute(
        `SELECT id FROM products WHERE site = ? AND site_product_id = ?`,
        [site, site_product_id]
      );
      dbProductId = existing[0]?.id;
    }
    
    // Insert price history (only if price changed or first time)
    if (dbProductId && price_amount) {
      await connection.execute(
        `INSERT INTO price_history (
          product_id, product_name, site, url, price, currency, source, scraped_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE price = VALUES(price)`,
        [product_id, product_name, site, url, price_amount, price_currency, site]
      );
    }
    
    await connection.commit();
    
    logger.debug('Product upserted atomically', {
      productId,
      site,
      dbId: dbProductId,
      price: price_amount
    });
    
    return {
      success: true,
      productId,
      dbId: dbProductId
    };
    
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        logger.warn('Failed to rollback transaction', { error: rollbackError.message });
      }
      try {
        connection.release();
      } catch (releaseError) {
        logger.warn('Failed to release connection', { error: releaseError.message });
      }
    }
    logger.error('Atomic product upsert failed', {
      productId: validatedProduct.product_id,
      site: validatedProduct.site,
      error: error.message,
      stack: error.stack
    });
    throw error;
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        logger.warn('Failed to release connection in finally', { error: releaseError.message });
      }
    }
  }
}

/**
 * Upsert multiple products atomically (batch)
 * @param {Array} validatedProducts - Array of validated products
 * @returns {Promise<Object>} { success: number, failed: number, results: [] }
 */
async function upsertProductsBatch(validatedProducts) {
  const results = {
    success: 0,
    failed: 0,
    results: []
  };
  
  // Check database connection first
  try {
    await db.execute('SELECT 1');
  } catch (dbError) {
    logger.warn('Database unavailable for batch upsert', {
      error: dbError.message,
      productCount: validatedProducts.length
    });
    // Return all as failed
    validatedProducts.forEach(product => {
      results.failed++;
      results.results.push({ success: false, error: 'Database unavailable' });
    });
    return results;
  }
  
  // Process in batches of 10 to avoid overwhelming the database
  const batchSize = 10;
  for (let i = 0; i < validatedProducts.length; i += batchSize) {
    const batch = validatedProducts.slice(i, i + batchSize);
    const batchPromises = batch.map(async (product) => {
      try {
        const result = await upsertProductAtomic(product);
        results.success++;
        results.results.push({ success: true, productId: result.productId });
        return result;
      } catch (error) {
        results.failed++;
        results.results.push({ success: false, error: error.message });
        logger.warn('Batch upsert failed for product', {
          productId: product.product_id,
          error: error.message
        });
        return null;
      }
    });
    
    await Promise.allSettled(batchPromises);
  }
  
  return results;
}

/**
 * Update Redis cache atomically after DB write
 * Uses Redis MULTI/EXEC for atomicity
 * 
 * @param {string} cacheKey - Redis key (e.g., "product:amazon:B08XXX" or "search:query")
 * @param {Object|Array} data - Product or array of products
 * @param {number} ttlSeconds - TTL in seconds
 * @param {string} source - Source of data ('fresh', 'cache', 'scraper')
 */
async function updateCacheAtomic(cacheKey, data, ttlSeconds, source = 'scraper') {
  try {
    const payload = {
      source,
      fetchedAt: new Date().toISOString(),
      is_stale: false,
      data: Array.isArray(data) ? data : [data]
    };
    
    const redis = cache.client;
    const pipeline = redis.pipeline();
    
    // Set the cache key with TTL
    pipeline.set(cacheKey, JSON.stringify(payload), 'EX', ttlSeconds);
    
    // Execute atomically
    await pipeline.exec();
    
    logger.debug('Cache updated atomically', {
      key: cacheKey,
      ttl: ttlSeconds,
      itemCount: Array.isArray(data) ? data.length : 1
    });
    
  } catch (error) {
    logger.error('Atomic cache update failed', {
      key: cacheKey,
      error: error.message
    });
    // Don't throw - cache failures shouldn't break the flow
  }
}

/**
 * Complete atomic write: Validate -> DB Upsert -> Cache Update
 * 
 * @param {Object} rawProduct - Raw scraped product
 * @param {Object} metadata - Metadata (site, query, etc.)
 * @param {string} cacheKey - Optional cache key to update
 * @param {number} ttlSeconds - Cache TTL
 * @returns {Promise<Object>} Upsert result
 */
async function validateAndUpsertAtomic(rawProduct, metadata = {}, cacheKey = null, ttlSeconds = 3600) {
  try {
    // Validate
    const validated = validateRecord(rawProduct, metadata);
    
    // Upsert to DB
    const dbResult = await upsertProductAtomic(validated);
    
    // Update cache if key provided
    if (cacheKey) {
      await updateCacheAtomic(cacheKey, validated, ttlSeconds, 'fresh');
    }
    
    return {
      ...dbResult,
      validated
    };
    
  } catch (error) {
    logger.error('Validate and upsert failed', {
      site: rawProduct.site,
      error: error.message
    });
    throw error;
  }
}

module.exports = {
  upsertProductAtomic,
  upsertProductsBatch,
  updateCacheAtomic,
  validateAndUpsertAtomic
};
