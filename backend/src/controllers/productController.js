/**
 * Product Controller - SWR Pattern Implementation
 * PHASE 1: Immediate Display & Cache Layer Integration
 * 
 * Handles product search requests with SWR (Stale-While-Revalidate) pattern:
 * 1. Check cache → return immediately if found
 * 2. If stale → return cached data + enqueue background refresh
 * 3. If cache miss → return placeholder + enqueue scrape job
 */

const cacheService = require('../services/cacheService');
const jobQueue = require('../services/jobQueue');
const logger = require('../utils/logger');

/**
 * Search products with SWR pattern
 * @param {string} query - Search query
 * @param {Object} options - Options (forceFresh, freshnessThresholdMinutes)
 * @returns {Promise<Object>} Response with status and data
 */
async function searchProducts(query, options = {}) {
  const { forceFresh = false, freshnessThresholdMinutes = 120 } = options;
  const cacheKey = cacheService.getSearchKey(query);
  
  try {
    // 1. Check cache (unless forceFresh)
    if (!forceFresh) {
      const cached = await cacheService.getCache(cacheKey, freshnessThresholdMinutes);
      
      if (cached && cached.data) {
        logger.info('Cache hit for search', {
          query,
          isStale: cached.is_stale,
          fetchedAt: cached.fetchedAt,
        });
        
        // 2. Return cached data immediately
        const response = {
          status: cached.is_stale ? 'refreshing' : 'cached',
          source: cached.source,
          fetchedAt: cached.fetchedAt,
          is_stale: cached.is_stale,
          data: cached.data,
        };
        
        // 3. Trigger background refresh if stale
        if (cached.is_stale) {
          await jobQueue.add('USER_TRIGGERED_SCRAPE', {
            query,
            cacheKey,
            type: 'search',
          }, {
            priority: 1,
          });
          logger.debug('Queued background refresh for stale cache', { query });
        }
        
        return response;
      }
    }
    
    // 4. Cache miss - return placeholder and enqueue scrape
    logger.info('Cache miss - enqueuing scrape job', { query });
    
    await jobQueue.add('USER_TRIGGERED_SCRAPE', {
      query,
      cacheKey,
      type: 'search',
    }, {
      priority: 2, // Higher priority for user-triggered
    });
    
    return {
      status: 'pending',
      source: 'none',
      fetchedAt: null,
      is_stale: true,
      data: [],
      message: 'Searching... Results will appear shortly.',
    };
    
  } catch (error) {
    logger.error('Product search failed', {
      query,
      error: error.message,
      stack: error.stack,
    });
    
    return {
      status: 'error',
      source: 'error',
      fetchedAt: null,
      is_stale: true,
      data: [],
      error: error.message,
    };
  }
}

/**
 * Get product by ID with SWR pattern
 * @param {string} site - Site name
 * @param {string} siteProductId - Site product ID
 * @param {Object} options - Options (forceFresh, freshnessThresholdMinutes)
 * @returns {Promise<Object>} Response with status and data
 */
async function getProduct(site, siteProductId, options = {}) {
  const { forceFresh = false, freshnessThresholdMinutes = 60 } = options;
  const cacheKey = cacheService.getProductKey(site, siteProductId);
  
  try {
    // 1. Check cache
    if (!forceFresh) {
      const cached = await cacheService.getCache(cacheKey, freshnessThresholdMinutes);
      
      if (cached && cached.data) {
        logger.info('Cache hit for product', {
          site,
          siteProductId,
          isStale: cached.is_stale,
        });
        
        const response = {
          status: cached.is_stale ? 'refreshing' : 'cached',
          source: cached.source,
          fetchedAt: cached.fetchedAt,
          is_stale: cached.is_stale,
          data: cached.data,
        };
        
        // Trigger refresh if stale
        if (cached.is_stale) {
          await jobQueue.add('DELTA_REFRESH', {
            site,
            siteProductId,
            cacheKey,
          }, {
            priority: 1,
          });
        }
        
        return response;
      }
    }
    
    // Cache miss - enqueue scrape
    logger.info('Cache miss - enqueuing product scrape', { site, siteProductId });
    
    await jobQueue.add('USER_TRIGGERED_SCRAPE', {
      site,
      siteProductId,
      cacheKey,
      type: 'product',
    }, {
      priority: 2,
    });
    
    return {
      status: 'pending',
      source: 'none',
      fetchedAt: null,
      is_stale: true,
      data: null,
      message: 'Fetching product details...',
    };
    
  } catch (error) {
    logger.error('Get product failed', {
      site,
      siteProductId,
      error: error.message,
    });
    
    return {
      status: 'error',
      source: 'error',
      fetchedAt: null,
      is_stale: true,
      data: null,
      error: error.message,
    };
  }
}

module.exports = {
  searchProducts,
  getProduct,
};
