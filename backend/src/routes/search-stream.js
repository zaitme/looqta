/**
 * Streaming search endpoint with parallel scraper execution
 * Uses Server-Sent Events (SSE) to stream results as they become available
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const registry = require('../scrapers/scraperRegistry');
const cache = require('../cache/redis');
const { shouldRebuildCache, mergeResults, findNewAndUpdatedItems, getProductKey } = require('../utils/cache-utils');
const { validateRecords } = require('../utils/product-validation');
const { upsertProductsBatch } = require('../utils/product-upsert');

/**
 * Transform validated product records to frontend format
 * Maps image_url -> image, price_amount -> price, etc.
 */
function transformToFrontendFormat(results) {
  if (!Array.isArray(results)) return results;
  return results.map(result => ({
    ...result,
    image: result.image_url || result.image || null,
    price: result.price_amount || result.price || null,
    currency: result.price_currency || result.currency || 'SAR',
    product_name: result.product_name || result.name || null
  }));
}

/**
 * Stream search results as they become available from parallel scrapers
 */
router.get('/stream', async (req, res) => {
  const q = (req.query.q || req.query.query || '').trim();
  const forceFresh = req.query.forceFresh === 'true' || req.query.fresh === 'true';
  
  // Additional validation (input already sanitized by middleware)
  if (!q) {
    logger.warn('Search request missing query parameter', { 
      ip: req.ip,
      'x-forwarded-for': req.headers['x-forwarded-for'] || null,
      'x-real-ip': req.headers['x-real-ip'] || null
    });
    return res.status(400).json({error:'query is required'});
  }
  
  // Validate query length
  if (q.length > 500) {
    logger.warn('Search query too long', { 
      ip: req.ip,
      length: q.length,
      'x-forwarded-for': req.headers['x-forwarded-for'] || null,
      'x-real-ip': req.headers['x-real-ip'] || null
    });
    return res.status(400).json({error:'query too long (max 500 characters)'});
  }
  
  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  
  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  
  try {
    logger.info('Processing streaming search request', { 
      query: q, 
      forceFresh,
      ip: req.ip,
      'x-forwarded-for': req.headers['x-forwarded-for'] || null,
      'x-forwarded-proto': req.headers['x-forwarded-proto'] || null,
      'x-forwarded-host': req.headers['x-forwarded-host'] || null,
      'x-real-ip': req.headers['x-real-ip'] || null
    });
    
    // Check cache first (unless forceFresh is true)
    const cacheKey = `search:${q.toLowerCase()}`;
    let cachedResults = null;
    const cached = forceFresh ? null : await cache.get(cacheKey);
    if (cached) {
      try {
        cachedResults = JSON.parse(cached);
        logger.info('Cache hit for search query', { query: q, cachedCount: cachedResults.length });
        
        // Sort cached results by price (lowest first) - best deals first
        cachedResults.sort((a, b) => {
          const priceA = a.price || Infinity;
          const priceB = b.price || Infinity;
          return priceA - priceB;
        });
        
        // Transform cached results to frontend format
        const frontendCachedResults = transformToFrontendFormat(cachedResults);
        
        // Send cached results immediately (best deals first)
        sendEvent('results', { 
          fromCache: true, 
          data: frontendCachedResults,
          message: 'Results from cache. Checking for updates...'
        });
        
        // Send cache-ready event so frontend can stop loading immediately
        sendEvent('cache-ready', {
          fromCache: true,
          data: frontendCachedResults,
          totalResults: frontendCachedResults.length,
          message: 'Results loaded from cache. Updating in background...'
        });
        
        // Continue scraping in background for delta updates
        // Don't end connection - keep it open for updates
      } catch (parseError) {
        logger.error('Failed to parse cached data', { 
          query: q, 
          error: parseError.message 
        });
      }
    }
    
    // Send initial event
    sendEvent('start', { query: q, message: 'Starting search...' });
    
    // Get all active scrapers
    const scrapers = registry.getActiveScrapers();
    const allResults = [];
    const scraperStatus = {};
    
    // Initialize status for all scrapers
    scrapers.forEach(s => {
      const name = s.name || s.constructor?.name || 'unknown';
      scraperStatus[name] = { status: 'pending', results: 0, error: null };
    });
    
    sendEvent('status', { scrapers: scraperStatus });
    
    // Function to send incremental updates sorted by best deals first
    let incrementalResults = cachedResults ? [...cachedResults] : [];
    const sendIncrementalUpdate = (newResults) => {
      // Merge new results with existing incremental results
      const merged = [...incrementalResults];
      const existingKeys = new Set(incrementalResults.map(item => getProductKey(item)));
      
      // Add only truly new items
      newResults.forEach(item => {
        const key = getProductKey(item);
        if (key && !existingKeys.has(key)) {
          merged.push(item);
          existingKeys.add(key);
        }
      });
      
      // Sort by price (best deals first)
      merged.sort((a, b) => {
        const priceA = a.price || Infinity;
        const priceB = b.price || Infinity;
        return priceA - priceB;
      });
      
      incrementalResults = merged;
      
      // Transform to frontend format before sending
      const frontendIncrementalResults = transformToFrontendFormat(incrementalResults);
      
      // Send incremental update
      sendEvent('results', {
        incremental: true,
        data: frontendIncrementalResults,
        totalCount: frontendIncrementalResults.length
      });
    };
    
    // Run all scrapers in parallel using Promise.allSettled
    // Each scraper runs in its own "thread" (async task) - Node.js handles concurrency
    const scraperPromises = scrapers.map(async (scraper) => {
      const scraperName = scraper.name || scraper.constructor?.name || 'unknown';
      
      try {
        logger.debug(`Running scraper: ${scraperName}`, { query: q });
        scraperStatus[scraperName].status = 'running';
        sendEvent('status', { scrapers: scraperStatus });
        
        // Extra scraper is slow - run with timeout to prevent blocking
        let results;
        if (scraperName === 'extra') {
          // Run Extra scraper with timeout (15 seconds max) to prevent blocking
          const timeoutMs = 15000;
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Extra scraper timeout')), timeoutMs)
          );
          
          try {
            results = await Promise.race([
              scraper.search(q),
              timeoutPromise
            ]);
          } catch (timeoutError) {
            if (timeoutError.message === 'Extra scraper timeout') {
              logger.warn(`Extra scraper timed out after ${timeoutMs}ms, skipping to prevent blocking`, { query: q });
            } else {
              logger.error(`Extra scraper error: ${timeoutError.message}`, { query: q });
            }
            results = [];
          }
        } else {
          // Other scrapers run normally with individual error handling
          try {
            results = await scraper.search(q);
          } catch (scraperError) {
            logger.error(`Scraper ${scraperName} error`, { 
              query: q, 
              error: scraperError.message,
              stack: scraperError.stack 
            });
            results = [];
          }
        }
        
        if (results && Array.isArray(results) && results.length > 0) {
          scraperStatus[scraperName].status = 'completed';
          scraperStatus[scraperName].results = results.length;
          
          // Sort results by price (best deals first) before sending
          const sortedResults = [...results].sort((a, b) => {
            const priceA = a.price || Infinity;
            const priceB = b.price || Infinity;
            return priceA - priceB;
          });
          
          // Transform results to frontend format before sending
          const frontendSortedResults = transformToFrontendFormat(sortedResults);
          
          // Send results immediately as they arrive - sorted by best deals first
          sendEvent('results', {
            scraper: scraperName,
            results: frontendSortedResults,
            count: frontendSortedResults.length
          });
          
          // Send incremental update with all results so far (best deals first)
          sendIncrementalUpdate(frontendSortedResults);
          
          // Add to all results
          allResults.push(...results);
          
          logger.info(`Scraper ${scraperName} returned ${results.length} results`, { 
            query: q, 
            scraper: scraperName
          });
        } else {
          scraperStatus[scraperName].status = 'completed';
          scraperStatus[scraperName].results = 0;
          logger.warn(`Scraper ${scraperName} returned no results`, { query: q });
        }
        
        sendEvent('status', { scrapers: scraperStatus });
        
      } catch (error) {
        scraperStatus[scraperName].status = 'error';
        scraperStatus[scraperName].error = error.message;
        scraperStatus[scraperName].results = 0;
        
        // Don't log timeout errors as errors - they're expected for slow scrapers
        if (error.message && error.message.includes('timeout')) {
          logger.warn(`Scraper ${scraperName} timed out`, { 
            query: q,
            scraper: scraperName,
            error: error.message
          });
        } else {
          logger.error('Scraper error', { 
            query: q,
            scraper: scraperName,
            error: error.message,
            stack: error.stack 
          });
        }
        
        sendEvent('error', {
          scraper: scraperName,
          error: error.message
        });
        
        sendEvent('status', { scrapers: scraperStatus });
      }
    });
    
    // Wait for all scrapers to complete
    await Promise.allSettled(scraperPromises);
    
    // Perform delta search - check for new vs cached results from Redis and database
    let finalResults = allResults;
    let hasChanges = false;
    
    // Get cached results from Redis if not already retrieved
    let redisCachedResults = cachedResults;
    if (!redisCachedResults) {
      try {
        const redisCached = await cache.get(cacheKey);
        if (redisCached) {
          redisCachedResults = JSON.parse(redisCached);
        }
      } catch (redisError) {
        logger.debug('Could not retrieve cached results from Redis for delta comparison', { query: q });
      }
    }
    
    // Perform delta comparison with cached results
    if (redisCachedResults && redisCachedResults.length > 0) {
      const comparison = findNewAndUpdatedItems(redisCachedResults, allResults);
      
      if (comparison.hasChanges) {
        hasChanges = true;
        logger.info('Delta search: Found changes', {
          query: q,
          newItems: comparison.newItems.length,
          updatedItems: comparison.updatedItems.length,
          removedItems: comparison.removedItems.length
        });
        
        // Delta cache merge: add new, update existing, remove stale
        finalResults = mergeResults(redisCachedResults, allResults, {
          keepRemovedItems: false, // Remove items no longer in new results
          prioritizeNewPrices: true, // Use new prices when available
          removeStaleThreshold: 0 // Always remove items not in new results (delta caching)
        });
      } else {
        logger.debug('Delta search: No changes detected', { query: q });
        finalResults = allResults;
      }
    } else if (allResults.length > 0) {
      // No cache, but we have fresh results
      hasChanges = true;
      finalResults = allResults;
    }
    
    // Sort by best deal (lowest price first) after delta search
    finalResults.sort((a, b) => {
      const priceA = a.price || Infinity; // Products without price go to end
      const priceB = b.price || Infinity;
      return priceA - priceB;
    });
    
    // If we have changes or fresh results, send update event with sorted results
    if (hasChanges || (allResults.length > 0 && !redisCachedResults)) {
      // Calculate comparison once if we have cached results
      let comparison = null;
      if (redisCachedResults && redisCachedResults.length > 0) {
        comparison = findNewAndUpdatedItems(redisCachedResults, allResults);
      }
      
      // Send notification about updated results (already sorted by best deal)
      sendEvent('cache-updated', {
        newItems: comparison ? comparison.newItems.length : (allResults.length > 0 ? allResults.length : 0),
        updatedItems: comparison ? comparison.updatedItems.length : 0,
        removedItems: comparison ? comparison.removedItems.length : 0,
        data: finalResults, // Send updated results sorted by best deal
        totalResults: finalResults.length,
        message: comparison 
          ? `Found ${comparison.newItems.length} new item(s) and ${comparison.updatedItems.length} updated item(s)`
          : `Found ${allResults.length} fresh result(s)`
      });
      
      // Also send incremental update with final merged results (sorted by best deal)
      sendIncrementalUpdate(finalResults);
    }
    
    // Save to cache (already sorted by best deal)
    try {
      await cache.set(cacheKey, JSON.stringify(finalResults), process.env.CACHE_TTL_SECONDS || 43200);
      logger.debug('Results cached successfully', { 
        query: q, 
        resultCount: finalResults.length,
        wasRebuilt: redisCachedResults && finalResults.length !== redisCachedResults.length
      });
    } catch (cacheError) {
      logger.warn('Failed to cache results', { 
        query: q, 
        error: cacheError.message 
      });
    }
    
    // Save results to database in parallel (async, don't block response)
    (async () => {
      try {
        if (finalResults && finalResults.length > 0) {
          // Validate all results
          const validationResults = validateRecords(finalResults, { query: q });
          
          if (validationResults.valid && validationResults.valid.length > 0) {
            // Save valid results to database in batch
            const upsertResults = await upsertProductsBatch(validationResults.valid);
            logger.info('Streaming search results saved to database', {
              query: q,
              total: finalResults.length,
              valid: validationResults.valid.length,
              invalid: validationResults.invalid.length,
              saved: upsertResults.success,
              failed: upsertResults.failed
            });
          }
        }
      } catch (dbError) {
        logger.error('Failed to save streaming search results to database', {
          query: q,
          error: dbError.message,
          stack: dbError.stack
        });
      }
    })();
    
    // Transform final results to frontend format
    const frontendFinalResults = transformToFrontendFormat(finalResults);
    
    // Send final completion event with sorted results (best deals first)
    sendEvent('complete', {
      fromCache: false,
      data: frontendFinalResults, // Already sorted by best deal
      totalResults: frontendFinalResults.length,
      scraperStatus: scraperStatus
    });
    
    logger.info('Streaming search completed', { 
      query: q, 
      resultCount: finalResults.length, 
      fromCache: false 
    });
    
  } catch (error) {
    logger.error('Streaming search request failed', { 
      query: q, 
      error: error.message, 
      stack: error.stack 
    });
    try {
      sendEvent('error', { error: 'Internal server error', message: error.message });
    } catch (sendError) {
      // If we can't send the error event, log it
      logger.error('Failed to send error event', { error: sendError.message });
    }
  } finally {
    try {
      res.end();
    } catch (endError) {
      // Connection might already be closed
      logger.debug('Error ending response (connection may be closed)', { error: endError.message });
    }
  }
});

module.exports = router;
