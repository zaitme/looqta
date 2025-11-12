/**
 * Enhanced Search Route with SWR (Stale-While-Revalidate) Pattern
 * Implements PHASE 1: Real-Time Architecture & UX Strategy
 * 
 * This is an enhanced version that can replace the existing search route
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const registry = require('../scrapers/scraperRegistry');
const cache = require('../cache/redis');
const jobQueue = require('../utils/job-queue');
const { validateRecords } = require('../utils/product-validation');
const { upsertProductsBatch, updateCacheAtomic } = require('../utils/product-upsert');
const { logPriceHistory } = require('../utils/price-history');

/**
 * Fast scrape with timeout (for cold requests)
 * Attempts to scrape within bounded time (max 8-10 seconds)
 */
async function fastScrapeWithTimeout(query, maxTimeoutMs = 8000) {
  const scrapers = registry.getActiveScrapers();
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Scrape timeout')), maxTimeoutMs)
  );
  
  const scrapePromise = Promise.allSettled(
    scrapers.map(async (scraper) => {
      try {
        return await scraper.search(query);
      } catch (error) {
        logger.warn('Fast scrape error', { scraper: scraper.name, error: error.message });
        return [];
      }
    })
  );
  
  try {
    const results = await Promise.race([scrapePromise, timeoutPromise]);
    if (results.status === 'fulfilled') {
      const allResults = [];
      results.value.forEach(r => {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          allResults.push(...r.value);
        }
      });
      return allResults;
    }
    throw new Error('Scrape timeout');
  } catch (error) {
    if (error.message === 'Scrape timeout') {
      throw error;
    }
    throw error;
  }
}

/**
 * Background refresh job processor
 */
async function processRefreshSearchJob(data) {
  const { query, cacheKey } = data;
  logger.info('Processing background refresh job', { query });
  
  try {
    // Scrape fresh data
    const scrapers = registry.getActiveScrapers();
    const allResults = [];
    
    const scraperPromises = scrapers.map(async (scraper) => {
      try {
        const results = await scraper.search(query);
        return Array.isArray(results) ? results : [];
      } catch (error) {
        logger.warn('Background scrape error', { scraper: scraper.name, error: error.message });
        return [];
      }
    });
    
    const results = await Promise.allSettled(scraperPromises);
    results.forEach(r => {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) {
        allResults.push(...r.value);
      }
    });
    
    // Validate all records
    const { valid, invalid } = validateRecords(allResults, { query });
    
    if (invalid.length > 0) {
      logger.warn('Some products failed validation in background refresh', {
        query,
        invalidCount: invalid.length
      });
    }
    
    // Upsert to database (only valid products)
    if (valid.length > 0) {
      await upsertProductsBatch(valid);
      
      // Log price history
      await logPriceHistory(valid);
    }
    
    // Update cache with fresh data
    const ttl = cache.getTtlForTier('WARM'); // Default to WARM tier for searches
    await updateCacheAtomic(cacheKey, valid, ttl, 'fresh');
    
    logger.info('Background refresh completed', {
      query,
      validCount: valid.length,
      invalidCount: invalid.length
    });
    
  } catch (error) {
    logger.error('Background refresh job failed', {
      query,
      error: error.message,
      stack: error.stack
    });
  }
}

// Register job processor
jobQueue.registerProcessor('refresh_search', processRefreshSearchJob);

/**
 * GET /api/search?q=...
 * SWR-enabled search endpoint
 */
router.get('/', async (req, res) => {
  const q = (req.query.q || req.query.query || '').trim();
  const forceFresh = req.query.forceFresh === 'true' || req.query.fresh === 'true';
  
  if (!q) {
    return res.status(400).json({ error: 'query is required' });
  }
  
  if (q.length > 500) {
    return res.status(400).json({ error: 'query too long (max 500 characters)' });
  }
  
  const cacheKey = `search:${q.toLowerCase()}`;
  const freshnessThreshold = cache.getFreshnessThresholdForTier('WARM'); // 2 hours for searches
  
  try {
    // 1. Read Cache (fast)
    if (!forceFresh) {
      const cached = await cache.getWithMetadata(cacheKey, freshnessThreshold);
      
      if (cached && cached.data) {
        // 2. Serve Stale (immediate)
        logger.info('Cache hit for search', {
          query: q,
          isStale: cached.is_stale,
          fetchedAt: cached.fetchedAt
        });
        
        // Return cached data immediately
        res.json({
          source: cached.source,
          fetchedAt: cached.fetchedAt,
          is_stale: cached.is_stale,
          results: Array.isArray(cached.data) ? cached.data : cached.data
        });
        
        // 3. Trigger Update (async) if stale
        if (cached.is_stale) {
          jobQueue.add('refresh_search', { query: q, cacheKey }, { priority: 1 });
          logger.debug('Queued background refresh for stale cache', { query: q });
        }
        
        return; // Exit early
      }
    }
    
    // 4. No Cache Found (cold request) - try fast scrape with timeout
    logger.info('Cold request - attempting fast scrape', { query: q });
    
    try {
      const results = await fastScrapeWithTimeout(q, 8000); // 8 second timeout
      
      if (results && results.length > 0) {
        // Validate records
        const { valid, invalid } = validateRecords(results, { query: q });
        
        if (invalid.length > 0) {
          logger.warn('Some products failed validation', {
            query: q,
            invalidCount: invalid.length
          });
        }
        
        // Upsert to database (only valid products)
        if (valid.length > 0) {
          await upsertProductsBatch(valid);
          await logPriceHistory(valid);
        }
        
        // Update cache
        const ttl = cache.getTtlForTier('WARM');
        await updateCacheAtomic(cacheKey, valid, ttl, 'fresh');
        
        // Return fresh results
        res.json({
          source: 'fresh',
          fetchedAt: new Date().toISOString(),
          is_stale: false,
          results: valid
        });
        
      } else {
        // No results - return empty with message and queue background job
        jobQueue.add('refresh_search', { query: q, cacheKey }, { priority: 2 });
        
        res.json({
          source: 'none',
          fetchedAt: new Date().toISOString(),
          is_stale: false,
          results: [],
          message: 'Results are unavailable right now. We are refreshing.'
        });
      }
      
    } catch (timeoutError) {
      // Scrape timeout - return safe response and queue background job
      logger.warn('Fast scrape timeout', { query: q });
      jobQueue.add('refresh_search', { query: q, cacheKey }, { priority: 2 });
      
      res.json({
        source: 'none',
        fetchedAt: new Date().toISOString(),
        is_stale: false,
        results: [],
        message: 'Results are unavailable right now. We are refreshing.'
      });
    }
    
  } catch (error) {
    logger.error('Search request failed', {
      query: q,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'internal error' });
  }
});

module.exports = router;
