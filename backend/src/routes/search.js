const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const registry = require('../scrapers/scraperRegistry');
const cache = require('../cache/redis');
const { shouldRebuildCache, mergeResults, findNewAndUpdatedItems } = require('../utils/cache-utils');
const { logPriceHistory } = require('../utils/price-history');
const { incrementSearchCounts } = require('../utils/product-metrics');
const { validateAndUpsertAtomic, upsertProductsBatch } = require('../utils/product-upsert');
const { validateRecords } = require('../utils/product-validation');

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
 * Perform delta search - check for new results compared to cached ones
 * Only adds new results, updates existing ones, removes stale ones
 * Returns updated results array
 * Runs scrapers in parallel for efficiency
 */
async function performDeltaSearch(query, cachedResults, cacheKey) {
  logger.info('Starting delta search', { query, cachedCount: cachedResults.length });
  
  // Run all scrapers in parallel for maximum efficiency
  const scrapers = registry.getActiveScrapers();
  const allResults = [];
  
  // Execute all scrapers in parallel using Promise.allSettled
  // This ensures all scrapers run concurrently and we don't wait for slow ones
  const scraperPromises = scrapers.map(async (scraper) => {
    const scraperName = scraper.name || scraper.constructor?.name || 'unknown';
    try {
      const results = await scraper.search(query);
      if (results && Array.isArray(results) && results.length > 0) {
        logger.debug(`Delta search: ${scraperName} returned ${results.length} results`, { query });
        return results;
      }
      return [];
    } catch (error) {
      logger.error('Delta search scraper error', { 
        query, 
        scraper: scraperName,
        error: error.message 
      });
      return [];
    }
  });
  
  // Wait for all scrapers to complete (parallel execution)
  const scraperResultsArray = await Promise.allSettled(scraperPromises);
  scraperResultsArray.forEach((result) => {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      allResults.push(...result.value);
    }
  });
  
  // Perform delta comparison
  const comparison = findNewAndUpdatedItems(cachedResults, allResults);
  
  let finalResults = cachedResults; // Default to cached results
  
  if (comparison.hasChanges) {
    logger.info('Delta search found changes', {
      query,
      newItems: comparison.newItems.length,
      updatedItems: comparison.updatedItems.length,
      removedItems: comparison.removedItems.length
    });
    
    // Merge results using delta algorithm
    finalResults = mergeResults(cachedResults, allResults, {
      keepRemovedItems: false,
      prioritizeNewPrices: true,
      removeStaleThreshold: 0
    });
    
    // Update cache with merged results
    try {
      await cache.set(cacheKey, JSON.stringify(finalResults), process.env.CACHE_TTL_SECONDS || 43200);
      logger.info('Cache updated with delta search results', { 
        query, 
        resultCount: finalResults.length,
        newItems: comparison.newItems.length
      });
    } catch (cacheError) {
      logger.warn('Failed to update cache after delta search', { 
        query, 
        error: cacheError.message 
      });
    }
  } else {
    logger.debug('Delta search: No changes found', { query });
  }
  
  return finalResults;
}

router.get('/', async (req, res) => {
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
  
  // Validate query length (additional check after sanitization)
  if (q.length > 500) {
    logger.warn('Search query too long', { 
      ip: req.ip,
      length: q.length,
      'x-forwarded-for': req.headers['x-forwarded-for'] || null,
      'x-real-ip': req.headers['x-real-ip'] || null
    });
    return res.status(400).json({error:'query too long (max 500 characters)'});
  }
  
  try {
    logger.info('Processing search request', { 
      query: q,
      ip: req.ip,
      'x-forwarded-for': req.headers['x-forwarded-for'] || null,
      'x-forwarded-proto': req.headers['x-forwarded-proto'] || null,
      'x-forwarded-host': req.headers['x-forwarded-host'] || null,
      'x-real-ip': req.headers['x-real-ip'] || null,
      forceFresh
    });
    
    // check cache (unless forceFresh is true)
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
        
        // Return cached results immediately, then continue scraping in background for delta updates
        // This allows users to see results right away while we check for new items
        res.json({ 
          fromCache: true, 
          data: frontendCachedResults,
          message: 'Results from cache. Checking for updates...'
        });
        
        // Continue to scrape in background to check for new items (delta search)
        // Don't await - let it run asynchronously
        (async () => {
          try {
            const updatedResults = await performDeltaSearch(q, cachedResults, cacheKey);
            // Log price history for updated results
            if (updatedResults && updatedResults.length > 0) {
              await logPriceHistory(updatedResults);
              // Track search metrics
              const productIds = updatedResults
                .map(r => r.product_id)
                .filter(Boolean);
              if (productIds.length > 0) {
                await incrementSearchCounts(productIds);
              }
              
              // Save delta search results to database
              try {
                const validationResults = validateRecords(updatedResults, { query: q });
                if (validationResults.valid && validationResults.valid.length > 0) {
                  const upsertResults = await upsertProductsBatch(validationResults.valid);
                  logger.info('Delta search results saved to database', {
                    query: q,
                    valid: validationResults.valid.length,
                    saved: upsertResults.success,
                    failed: upsertResults.failed
                  });
                }
              } catch (dbError) {
                logger.error('Failed to save delta search results to database', {
                  query: q,
                  error: dbError.message
                });
              }
            }
          } catch (error) {
            logger.error('Background delta search failed', { query: q, error: error.message });
          }
        })();
        
        return; // Exit early, background search continues
      } catch (parseError) {
        logger.error('Failed to parse cached data', { 
          query: q, 
          error: parseError.message 
        });
        // Continue to scrape if cache parse fails
      }
    }

    // No cache - run all scrapers and return results immediately as they come in
    // Sort by price (best deals first) and return incrementally
    const scrapers = registry.getActiveScrapers();
    const results = [];
    const scraperResults = {}; // Track results per scraper for validation
    const allScraperResults = []; // Track results per scraper
    
    // Initialize scraper results tracking
    scrapers.forEach(s => {
      const name = s.name || s.constructor?.name || 'unknown';
      scraperResults[name] = 0;
      allScraperResults[name] = [];
    });
    
    // Run all scrapers in parallel - results come in as they complete
    const scraperPromises = scrapers.map(async (scraper) => {
      const scraperName = scraper.name || scraper.constructor?.name || 'unknown';
      try {
        logger.debug(`Running scraper: ${scraperName}`, { query: q });
        const r = await scraper.search(q);
        if (r && Array.isArray(r) && r.length > 0) {
          scraperResults[scraperName] = r.length;
          allScraperResults[scraperName] = r;
          logger.info(`Scraper ${scraperName} returned ${r.length} results`, { 
            query: q, 
            scraper: scraperName,
            sampleProduct: r[0]?.product_name || 'N/A',
            sampleSite: r[0]?.site || 'N/A'
          });
          return r;
        } else {
          scraperResults[scraperName] = 0;
          logger.warn(`Scraper ${scraperName} returned no results`, { query: q });
          return [];
        }
      } catch (e) {
        scraperResults[scraperName] = 0;
        logger.error('Scraper error', { 
          query: q,
          scraper: scraperName,
          error: e.message,
          stack: e.stack 
        });
        return [];
      }
    });
    
    // Wait for all scrapers to complete and collect results
    const scraperResultsArray = await Promise.allSettled(scraperPromises);
    scraperResultsArray.forEach((result) => {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        results.push(...result.value);
      }
    });
    
    // Save results to database in parallel (async, don't block response)
    (async () => {
      try {
        if (results && results.length > 0) {
          // Validate all results
          const validationResults = validateRecords(results, { query: q });
          
          if (validationResults.valid && validationResults.valid.length > 0) {
            // Save valid results to database in batch
            const upsertResults = await upsertProductsBatch(validationResults.valid);
            logger.info('Scraper results saved to database', {
              query: q,
              total: results.length,
              valid: validationResults.valid.length,
              invalid: validationResults.invalid.length,
              saved: upsertResults.success,
              failed: upsertResults.failed
            });
          }
        }
      } catch (dbError) {
        logger.error('Failed to save scraper results to database', {
          query: q,
          error: dbError.message,
          stack: dbError.stack
        });
      }
    })();
    
    // Validation: Check if both scrapers returned results
    const expectedScrapers = ['amazon', 'noon'];
    const activeScrapers = Object.keys(scraperResults);
    const scrapersWithResults = activeScrapers.filter(name => scraperResults[name] > 0);
    
    logger.info('Scraper validation summary', {
      query: q,
      expectedScrapers: expectedScrapers.length,
      activeScrapers: activeScrapers.length,
      scrapersWithResults: scrapersWithResults.length,
      resultsByScraper: scraperResults,
      totalResults: results.length
    });
    
    if (scrapersWithResults.length < expectedScrapers.length) {
      logger.warn('Not all expected scrapers returned results', {
        query: q,
        expected: expectedScrapers.length,
        got: scrapersWithResults.length,
        missing: expectedScrapers.filter(s => !scrapersWithResults.some(r => r.includes(s)))
      });
    }

    // Sort results by price (best deals first) as they come in
    // This ensures best deals are shown immediately
    results.sort((a, b) => {
      const priceA = a.price || Infinity;
      const priceB = b.price || Infinity;
      return priceA - priceB;
    });
    
    // If we had cached results, perform delta merge
    let finalResults = results;
    if (cachedResults && cachedResults.length > 0) {
      const comparison = findNewAndUpdatedItems(cachedResults, results);
      
      if (comparison.hasChanges) {
        logger.info('Delta search: Found changes in fresh scrape', {
          query: q,
          newItems: comparison.newItems.length,
          updatedItems: comparison.updatedItems.length,
          removedItems: comparison.removedItems.length
        });
        
        // Delta cache merge: add new, update existing, remove stale
        finalResults = mergeResults(cachedResults, results, {
          keepRemovedItems: false, // Remove items no longer in new results
          prioritizeNewPrices: true, // Use new prices when available
          removeStaleThreshold: 0 // Always remove items not in new results (delta caching)
        });
      } else {
        // No changes detected, use cached results (they're already sorted)
        logger.debug('No changes detected, using fresh results', { query: q });
        finalResults = results;
      }
    }
    
    // Log price history for all products (async, don't wait)
    (async () => {
      try {
        await logPriceHistory(finalResults);
      } catch (historyError) {
        logger.warn('Failed to log price history', { 
          query: q, 
          error: historyError.message 
        });
      }
    })();
    
    // Track search metrics for products (async, don't wait)
    (async () => {
      try {
        const productIds = finalResults
          .map(r => r.product_id)
          .filter(Boolean);
        if (productIds.length > 0) {
          await incrementSearchCounts(productIds);
        }
      } catch (metricsError) {
        logger.warn('Failed to track search metrics', { 
          query: q, 
          error: metricsError.message 
        });
      }
    })();
    
    // save to cache (ttl seconds)
    try {
      await cache.set(cacheKey, JSON.stringify(finalResults), process.env.CACHE_TTL_SECONDS || 43200);
      logger.debug('Results cached successfully', { 
        query: q, 
        resultCount: finalResults.length,
        wasRebuilt: cachedResults && finalResults.length !== cachedResults.length
      });
    } catch (cacheError) {
      logger.warn('Failed to cache results', { 
        query: q, 
        error: cacheError.message 
      });
      // Continue even if caching fails
    }

    // Sort results by price (lowest first)
    finalResults.sort((a, b) => {
      const priceA = a.price || Infinity; // Products without price go to end
      const priceB = b.price || Infinity;
      return priceA - priceB;
    });
    
    // Transform validated records to frontend format
    const frontendResults = transformToFrontendFormat(finalResults);
    
    logger.info('Search completed', { 
      query: q, 
      resultCount: frontendResults.length, 
      fromCache: false 
    });
    res.json({ fromCache: false, data: frontendResults });
  } catch (e) {
    logger.error('Search request failed', { 
      query: q, 
      error: e.message, 
      stack: e.stack 
    });
    res.status(500).json({ error: 'internal error' });
  }
});

module.exports = router;
