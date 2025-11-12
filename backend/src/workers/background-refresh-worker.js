/**
 * Background worker for periodic cache refresh
 * Runs scrapers in the background to keep cache up-to-date
 */

const logger = require('../utils/logger');
const cache = require('../cache/redis');
const registry = require('../scrapers/scraperRegistry');
const { shouldRebuildCache, mergeResults } = require('../utils/cache-utils');

class BackgroundRefreshWorker {
  constructor(options = {}) {
    this.intervalMinutes = options.intervalMinutes || 60; // Refresh every hour by default
    this.popularQueries = options.popularQueries || []; // Popular queries to refresh
    this.maxConcurrentRefreshes = options.maxConcurrentRefreshes || 2;
    this.activeRefreshes = new Set();
    this.intervalId = null;
    this.isRunning = false;
  }

  /**
   * Refresh cache for a specific query
   * @param {string} query - Search query to refresh
   * @returns {Promise<Object>} - Refresh result
   */
  async refreshQuery(query) {
    if (this.activeRefreshes.has(query)) {
      logger.debug('Refresh already in progress', { query });
      return { skipped: true, reason: 'Already refreshing' };
    }

    if (this.activeRefreshes.size >= this.maxConcurrentRefreshes) {
      logger.debug('Max concurrent refreshes reached', { query });
      return { skipped: true, reason: 'Max concurrent refreshes' };
    }

    this.activeRefreshes.add(query);
    const cacheKey = `search:${query.toLowerCase()}`;

    try {
      logger.info('Background refresh started', { query });

      // Get cached results
      const cached = await cache.get(cacheKey);
      let cachedResults = null;
      if (cached) {
        try {
          cachedResults = JSON.parse(cached);
        } catch (e) {
          logger.warn('Failed to parse cached data for refresh', { query, error: e.message });
        }
      }

      // If no cache exists, skip (let regular search handle it)
      if (!cachedResults || cachedResults.length === 0) {
        logger.debug('No cache to refresh', { query });
        return { skipped: true, reason: 'No cache exists' };
      }

      // Run scrapers
      const scrapers = registry.getActiveScrapers();
      const allResults = [];

      const scraperPromises = scrapers.map(async (scraper) => {
        const scraperName = scraper.name || scraper.constructor?.name || 'unknown';
        try {
          logger.debug('Background scraper running', { query, scraperName });
          const results = await scraper.search(query);
          if (results && Array.isArray(results) && results.length > 0) {
            allResults.push(...results);
            logger.debug('Background scraper completed', {
              query,
              scraperName,
              resultCount: results.length
            });
          }
        } catch (error) {
          logger.error('Background scraper error', {
            query,
            scraperName,
            error: error.message
          });
        }
      });

      await Promise.allSettled(scraperPromises);

      // Check if cache should be rebuilt
      const rebuildDecision = shouldRebuildCache(cachedResults, allResults, {
        minNewItemsThreshold: 1,
        requirePriceChanges: true
      });

      if (rebuildDecision.shouldRebuild) {
        logger.info('Background cache rebuild triggered', {
          query,
          reason: rebuildDecision.reason,
          newItems: rebuildDecision.comparison.newItems.length,
          updatedItems: rebuildDecision.comparison.updatedItems.length
        });

        // Merge results
        const finalResults = mergeResults(cachedResults, allResults, {
          keepRemovedItems: false,
          prioritizeNewPrices: true
        });

        // Update cache
        await cache.set(
          cacheKey,
          JSON.stringify(finalResults),
          process.env.CACHE_TTL_SECONDS || 43200
        );

        return {
          success: true,
          query,
          cachedCount: cachedResults.length,
          newCount: finalResults.length,
          newItems: rebuildDecision.comparison.newItems.length,
          updatedItems: rebuildDecision.comparison.updatedItems.length,
          wasRebuilt: true
        };
      } else {
        logger.debug('No significant changes in background refresh', { query });
        return {
          success: true,
          query,
          cachedCount: cachedResults.length,
          newCount: allResults.length,
          wasRebuilt: false
        };
      }
    } catch (error) {
      logger.error('Background refresh error', {
        query,
        error: error.message,
        stack: error.stack
      });
      return {
        success: false,
        query,
        error: error.message
      };
    } finally {
      this.activeRefreshes.delete(query);
    }
  }

  /**
   * Refresh multiple queries in parallel
   * @param {Array<string>} queries - Array of queries to refresh
   * @returns {Promise<Array>} - Array of refresh results
   */
  async refreshQueries(queries) {
    logger.info('Refreshing multiple queries', { count: queries.length });
    const refreshPromises = queries.map(query => this.refreshQuery(query));
    return Promise.allSettled(refreshPromises);
  }

  /**
   * Start the background refresh worker
   */
  start() {
    if (this.isRunning) {
      logger.warn('Background refresh worker already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting background refresh worker', {
      intervalMinutes: this.intervalMinutes,
      popularQueries: this.popularQueries.length
    });

    // Run immediately on start
    if (this.popularQueries.length > 0) {
      this.refreshQueries(this.popularQueries).catch(err => {
        logger.error('Initial background refresh failed', { error: err.message });
      });
    }

    // Set up interval
    this.intervalId = setInterval(() => {
      if (this.popularQueries.length > 0) {
        logger.debug('Running scheduled background refresh', {
          queryCount: this.popularQueries.length
        });
        this.refreshQueries(this.popularQueries).catch(err => {
          logger.error('Scheduled background refresh failed', { error: err.message });
        });
      }
    }, this.intervalMinutes * 60 * 1000);
  }

  /**
   * Stop the background refresh worker
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    logger.info('Background refresh worker stopped', {
      activeRefreshes: this.activeRefreshes.size
    });
  }

  /**
   * Add a query to the popular queries list
   * @param {string} query - Query to add
   */
  addPopularQuery(query) {
    if (!this.popularQueries.includes(query.toLowerCase())) {
      this.popularQueries.push(query.toLowerCase());
      logger.debug('Added popular query', { query, total: this.popularQueries.length });
    }
  }

  /**
   * Remove a query from the popular queries list
   * @param {string} query - Query to remove
   */
  removePopularQuery(query) {
    const index = this.popularQueries.indexOf(query.toLowerCase());
    if (index > -1) {
      this.popularQueries.splice(index, 1);
      logger.debug('Removed popular query', { query, total: this.popularQueries.length });
    }
  }

  /**
   * Get worker statistics
   * @returns {Object} - Worker statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      intervalMinutes: this.intervalMinutes,
      popularQueries: this.popularQueries.length,
      activeRefreshes: this.activeRefreshes.size,
      maxConcurrentRefreshes: this.maxConcurrentRefreshes
    };
  }
}

module.exports = BackgroundRefreshWorker;
