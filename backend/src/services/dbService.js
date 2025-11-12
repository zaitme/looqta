/**
 * Database Service - Atomic Writes & Validation
 * PHASE 3: Atomic Database Write & Validation Pipeline
 * 
 * Handles atomic database operations with proper error handling
 */

const { upsertProductsBatch } = require('../utils/product-upsert');
const logger = require('../utils/logger');

/**
 * Upsert products to database (atomic batch operation)
 * @param {Array} products - Array of validated product records
 * @returns {Promise<Object>} { success: boolean, inserted: number, updated: number }
 */
async function upsertProducts(products) {
  if (!products || products.length === 0) {
    return { success: true, inserted: 0, updated: 0 };
  }
  
  try {
    const result = await upsertProductsBatch(products);
    logger.info('Products upserted to database', {
      count: products.length,
      inserted: result.inserted || 0,
      updated: result.updated || 0,
    });
    
    return {
      success: true,
      inserted: result.inserted || 0,
      updated: result.updated || 0,
    };
  } catch (error) {
    logger.error('Database upsert failed', {
      count: products.length,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Get product from database
 * @param {string} site - Site name
 * @param {string} siteProductId - Site product ID
 * @returns {Promise<Object|null>} Product record or null
 */
async function getProduct(site, siteProductId) {
  const db = require('../db/mysql');
  
  try {
    const [rows] = await db.execute(
      `SELECT * FROM products 
       WHERE site = ? AND site_product_id = ? 
       LIMIT 1`,
      [site, siteProductId]
    );
    
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    logger.error('Database get product failed', {
      site,
      siteProductId,
      error: error.message,
    });
    throw error;
  }
}

module.exports = {
  upsertProducts,
  getProduct,
};
