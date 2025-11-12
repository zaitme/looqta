/**
 * Cache Service - Enhanced Redis wrapper for SWR pattern
 * PHASE 1: Immediate Display & Cache Layer Integration
 * 
 * Provides high-level cache operations with SWR metadata
 */

const cache = require('../cache/redis');
const logger = require('../utils/logger');

/**
 * Get cached data with SWR metadata
 * @param {string} key - Cache key
 * @param {number} freshnessThresholdMinutes - Optional freshness threshold
 * @returns {Object|null} { data, source, fetchedAt, is_stale } or null
 */
async function getCache(key, freshnessThresholdMinutes = null) {
  try {
    return await cache.getWithMetadata(key, freshnessThresholdMinutes);
  } catch (error) {
    logger.error('Cache get failed', { key, error: error.message });
    return null;
  }
}

/**
 * Set cache with SWR metadata
 * @param {string} key - Cache key
 * @param {*} data - Data to cache
 * @param {number} ttlSeconds - TTL in seconds
 * @param {string} source - Source ('fresh', 'cache', 'scraper')
 */
async function setCache(key, data, ttlSeconds, source = 'scraper') {
  try {
    await cache.setWithMetadata(key, data, ttlSeconds, source);
    logger.debug('Cache set', { key, ttlSeconds, source });
  } catch (error) {
    logger.error('Cache set failed', { key, error: error.message });
    throw error;
  }
}

/**
 * Invalidate cache entry
 * @param {string} key - Cache key
 */
async function invalidateCache(key) {
  try {
    await cache.del(key);
    logger.debug('Cache invalidated', { key });
  } catch (error) {
    logger.error('Cache invalidation failed', { key, error: error.message });
  }
}

/**
 * Generate product cache key
 * @param {string} site - Site name
 * @param {string} siteProductId - Site product ID
 * @returns {string} Cache key
 */
function getProductKey(site, siteProductId) {
  return `product:${site}:${siteProductId}`;
}

/**
 * Generate search cache key
 * @param {string} query - Search query
 * @returns {string} Cache key
 */
function getSearchKey(query) {
  return `search:${query.toLowerCase().trim()}`;
}

module.exports = {
  getCache,
  setCache,
  invalidateCache,
  getProductKey,
  getSearchKey,
  // Expose underlying cache methods
  get: cache.get,
  set: cache.set,
  del: cache.del,
  client: cache.client
};
