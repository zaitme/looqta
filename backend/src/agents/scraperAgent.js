/**
 * Scraper Agent - Background Worker for Asynchronous Processing
 * PHASE 2: Asynchronous Background Processing
 * 
 * Consumes jobs from scrapeQueue and executes scraping operations
 * with rate limiting, concurrency control, and error handling
 */

const jobQueue = require('../services/jobQueue');
const cacheService = require('../services/cacheService');
const dbService = require('../services/dbService');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');
const registry = require('../scrapers/scraperRegistry');
const { validateRecords } = require('../utils/product-validation');

// Rate limiting per site (requests per second)
const rateLimits = {
  'amazon.sa': 2,
  'noon.com': 2,
  'jarir.com': 2,
  'extra.com': 2,
  'panda.com.sa': 2,
};

// Track last request time per site
const lastRequestTime = new Map();

/**
 * Apply rate limiting
 * @param {string} site - Site domain
 * @returns {Promise<void>}
 */
async function applyRateLimit(site) {
  const domain = site.toLowerCase();
  const limit = rateLimits[domain] || 2; // Default 2 req/sec
  const minDelay = 1000 / limit; // Milliseconds between requests
  
  const lastTime = lastRequestTime.get(domain) || 0;
  const now = Date.now();
  const elapsed = now - lastTime;
  
  if (elapsed < minDelay) {
    const waitTime = minDelay - elapsed;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime.set(domain, Date.now());
}

/**
 * Process USER_TRIGGERED_SCRAPE job
 * Full detail scrape for user-initiated searches
 */
async function processUserTriggeredScrape(jobData, job) {
  const { query, site, siteProductId, cacheKey, type } = jobData;
  
  try {
    logger.info('Processing user-triggered scrape', {
      query,
      site,
      siteProductId,
      type,
      jobId: job.id,
    });
    
    let results = [];
    
    if (type === 'search' && query) {
      // Search scrape - use all available scrapers
      const scrapers = registry.getAllScrapers();
      const scrapePromises = scrapers.map(async (scraper) => {
        try {
          await applyRateLimit(scraper.site);
          const scraperResults = await scraper.search(query);
          return scraperResults || [];
        } catch (error) {
          logger.warn('Scraper failed', {
            site: scraper.site,
            query,
            error: error.message,
          });
          return [];
        }
      });
      
      const allResults = await Promise.all(scrapePromises);
      results = allResults.flat();
      
    } else if (type === 'product' && site && siteProductId) {
      // Product detail scrape - use search with product ID as fallback
      // Most scrapers don't have getProductDetails, so we search for the product
      const scrapers = registry.getActiveScrapers();
      const matchingScraper = scrapers.find(s => 
        s.site && s.site.toLowerCase().includes(site.toLowerCase())
      );
      
      if (matchingScraper) {
        await applyRateLimit(site);
        // Try to search for the product using siteProductId
        // This is a fallback - ideally scrapers would have getProductDetails method
        try {
          const searchResults = await matchingScraper.search(siteProductId);
          if (searchResults && searchResults.length > 0) {
            // Find exact match by site_product_id
            const exactMatch = searchResults.find(r => 
              r.site_product_id === siteProductId || 
              r.url?.includes(siteProductId)
            );
            if (exactMatch) {
              results = [exactMatch];
            } else {
              // Use first result if no exact match
              results = [searchResults[0]];
            }
          }
        } catch (error) {
          logger.warn('Product detail scrape failed', {
            site,
            siteProductId,
            error: error.message,
          });
        }
      }
    }
    
    if (results.length === 0) {
      logger.warn('No results from scrape', { query, site, siteProductId });
      return { success: false, results: [] };
    }
    
    // Validate results
    const { valid, invalid } = validateRecords(results, { query, site });
    
    if (invalid.length > 0) {
      logger.warn('Some records failed validation', {
        validCount: valid.length,
        invalidCount: invalid.length,
      });
    }
    
    if (valid.length === 0) {
      logger.warn('No valid records after validation', { query, site });
      return { success: false, results: [] };
    }
    
    // Write to database (atomic)
    await dbService.upsertProducts(valid);
    
    // Update cache and notify
    if (cacheKey) {
      const ttlSeconds = process.env.CACHE_TTL_SECONDS || 43200; // 12 hours
      await cacheService.setCache(cacheKey, valid, ttlSeconds, 'fresh');
      
      // Notify waiting clients (if connectionId provided in job data)
      if (jobData.connectionId) {
        notificationService.notifySearchUpdate(query, valid, jobData.connectionId);
      } else {
        notificationService.notifySearchUpdate(query, valid);
      }
    }
    
    logger.info('User-triggered scrape completed', {
      query,
      site,
      validCount: valid.length,
      jobId: job.id,
    });
    
    return {
      success: true,
      results: valid,
      cacheKey,
    };
    
  } catch (error) {
    logger.error('User-triggered scrape failed', {
      query,
      site,
      siteProductId,
      error: error.message,
      stack: error.stack,
      jobId: job.id,
    });
    throw error; // Re-throw to trigger retry
  }
}

/**
 * Process DELTA_REFRESH job
 * Lightweight price check for existing products
 */
async function processDeltaRefresh(jobData, job) {
  const { site, siteProductId, cacheKey, productIds } = jobData;
  
  try {
    logger.info('Processing delta refresh', {
      site,
      siteProductId,
      productIds: productIds?.length,
      jobId: job.id,
    });
    
    // If productIds array provided, refresh multiple products
    if (productIds && Array.isArray(productIds)) {
      const scrapers = registry.getActiveScrapers();
      const matchingScraper = scrapers.find(s => 
        s.site && s.site.toLowerCase().includes(site.toLowerCase())
      );
      
      if (!matchingScraper) {
        throw new Error(`No scraper found for site: ${site}`);
      }
      
      const results = [];
      for (const productId of productIds.slice(0, 10)) { // Limit to 10 per job
        try {
          await applyRateLimit(site);
          // Search for product using productId
          const searchResults = await matchingScraper.search(productId);
          if (searchResults && searchResults.length > 0) {
            // Find exact match or use first result
            const product = searchResults.find(r => 
              r.site_product_id === productId || 
              r.url?.includes(productId)
            ) || searchResults[0];
            results.push(product);
          }
        } catch (error) {
          logger.warn('Delta refresh failed for product', {
            productId,
            error: error.message,
          });
        }
      }
      
      if (results.length > 0) {
        const { valid } = validateRecords(results, { site });
        await dbService.upsertProducts(valid);
        
        // Update cache for each product
        for (const product of valid) {
          const productKey = cacheService.getProductKey(product.site, product.site_product_id);
          const ttlSeconds = process.env.CACHE_TTL_SECONDS || 43200;
          await cacheService.setCache(productKey, product, ttlSeconds, 'fresh');
        }
      }
      
      return { success: true, updatedCount: results.length };
    }
    
    // Single product refresh
    if (site && siteProductId) {
      const scrapers = registry.getActiveScrapers();
      const matchingScraper = scrapers.find(s => 
        s.site && s.site.toLowerCase().includes(site.toLowerCase())
      );
      
      if (!matchingScraper) {
        throw new Error(`No scraper found for site: ${site}`);
      }
      
      await applyRateLimit(site);
      // Search for product using siteProductId
      const searchResults = await matchingScraper.search(siteProductId);
      
      if (!searchResults || searchResults.length === 0) {
        return { success: false, message: 'Product not found' };
      }
      
      // Find exact match or use first result
      const product = searchResults.find(r => 
        r.site_product_id === siteProductId || 
        r.url?.includes(siteProductId)
      ) || searchResults[0];
      
      const { valid } = validateRecords([product], { site });
      if (valid.length === 0) {
        return { success: false, message: 'Validation failed' };
      }
      
      await dbService.upsertProducts(valid);
      
      if (cacheKey) {
        const ttlSeconds = process.env.CACHE_TTL_SECONDS || 43200;
        await cacheService.setCache(cacheKey, valid[0], ttlSeconds, 'fresh');
        
        // Notify waiting clients
        if (jobData.connectionId) {
          notificationService.notifyProductUpdate(cacheKey, valid[0], jobData.connectionId);
        } else {
          notificationService.notifyProductUpdate(cacheKey, valid[0]);
        }
      }
      
      return { success: true, product: valid[0] };
    }
    
    return { success: false, message: 'Invalid job data' };
    
  } catch (error) {
    logger.error('Delta refresh failed', {
      site,
      siteProductId,
      error: error.message,
      stack: error.stack,
      jobId: job.id,
    });
    throw error;
  }
}

/**
 * Initialize scraper agent
 * Registers processors and creates worker
 */
function initialize() {
  // Register processors
  jobQueue.registerProcessor('USER_TRIGGERED_SCRAPE', processUserTriggeredScrape);
  jobQueue.registerProcessor('DELTA_REFRESH', processDeltaRefresh);
  
  // Create worker with concurrency control
  const worker = jobQueue.createWorker({
    concurrency: 3, // Max 3 concurrent scrapes
  });
  
  logger.info('Scraper agent initialized', {
    registeredTypes: ['USER_TRIGGERED_SCRAPE', 'DELTA_REFRESH'],
    concurrency: 3,
  });
  
  return worker;
}

module.exports = {
  initialize,
  processUserTriggeredScrape,
  processDeltaRefresh,
};
