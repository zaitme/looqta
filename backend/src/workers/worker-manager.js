/**
 * Worker Manager for parallel scraper execution using worker threads
 * Provides true parallelism for CPU-intensive scraping tasks
 */

const { Worker } = require('worker_threads');
const path = require('path');
const logger = require('../utils/logger');
const registry = require('../scrapers/scraperRegistry');

class WorkerManager {
  constructor(options = {}) {
    this.maxWorkers = options.maxWorkers || 4; // Maximum concurrent workers
    this.activeWorkers = new Map(); // Track active workers
    this.workerTimeout = options.workerTimeout || 120000; // 2 minutes timeout per worker
  }

  /**
   * Run a scraper in a worker thread
   * @param {Object} scraper - Scraper object with name property
   * @param {string} query - Search query
   * @returns {Promise<Object>} - { success: boolean, results: Array, scraperName: string }
   */
  async runScraperInWorker(scraper, query) {
    const scraperName = scraper.name || scraper.constructor?.name || 'unknown';
    const workerPath = path.join(__dirname, 'scraper-worker.js');
    
    return new Promise((resolve, reject) => {
      // Check if we've reached max workers
      if (this.activeWorkers.size >= this.maxWorkers) {
        logger.warn('Max workers reached, waiting for available slot', {
          active: this.activeWorkers.size,
          max: this.maxWorkers
        });
        // Wait a bit and retry (in production, use a queue)
        setTimeout(() => {
          this.runScraperInWorker(scraper, query).then(resolve).catch(reject);
        }, 1000);
        return;
      }

      const workerId = `${scraperName}-${Date.now()}`;
      logger.debug('Creating worker thread', { workerId, scraperName, query });

      // Find the scraper module path
      let scraperPath = null;
      try {
        // Try to resolve the scraper module
        if (scraperName === 'amazon') {
          scraperPath = path.join(__dirname, '../scrapers/amazon.js');
        } else if (scraperName === 'noon') {
          scraperPath = path.join(__dirname, '../scrapers/noon.js');
        } else {
          // Fallback: try to find it in the registry
          scraperPath = require.resolve(`../scrapers/${scraperName}.js`);
        }
      } catch (e) {
        logger.error('Could not resolve scraper path', { scraperName, error: e.message });
        reject(new Error(`Could not resolve scraper path for ${scraperName}`));
        return;
      }

      const worker = new Worker(workerPath, {
        workerData: {
          scraperName,
          query,
          scraperPath
        }
      });

      const timeout = setTimeout(() => {
        logger.warn('Worker timeout', { workerId, scraperName });
        worker.terminate();
        this.activeWorkers.delete(workerId);
        resolve({
          success: false,
          scraperName,
          results: [],
          error: 'Worker timeout'
        });
      }, this.workerTimeout);

      worker.on('message', (message) => {
        clearTimeout(timeout);
        this.activeWorkers.delete(workerId);
        worker.terminate();
        
        if (message.success) {
          logger.debug('Worker completed successfully', {
            workerId,
            scraperName: message.scraperName,
            resultCount: message.resultCount
          });
          resolve(message);
        } else {
          logger.error('Worker failed', {
            workerId,
            scraperName: message.scraperName,
            error: message.error
          });
          resolve(message); // Still resolve, but with error
        }
      });

      worker.on('error', (error) => {
        clearTimeout(timeout);
        this.activeWorkers.delete(workerId);
        logger.error('Worker error', {
          workerId,
          scraperName,
          error: error.message,
          stack: error.stack
        });
        worker.terminate();
        resolve({
          success: false,
          scraperName,
          results: [],
          error: error.message
        });
      });

      worker.on('exit', (code) => {
        clearTimeout(timeout);
        this.activeWorkers.delete(workerId);
        if (code !== 0) {
          logger.warn('Worker exited with non-zero code', { workerId, scraperName, code });
        }
      });

      this.activeWorkers.set(workerId, worker);
    });
  }

  /**
   * Run all scrapers in parallel using worker threads
   * @param {string} query - Search query
   * @returns {Promise<Array>} - Array of results from all scrapers
   */
  async runAllScrapers(query) {
    const scrapers = registry.getActiveScrapers();
    logger.info('Running scrapers in worker threads', {
      query,
      scraperCount: scrapers.length,
      maxWorkers: this.maxWorkers
    });

    // Run all scrapers in parallel using worker threads
    const workerPromises = scrapers.map(scraper =>
      this.runScraperInWorker(scraper, query)
    );

    const results = await Promise.allSettled(workerPromises);
    
    const allResults = [];
    const scraperStatus = {};

    results.forEach((result, index) => {
      const scraper = scrapers[index];
      const scraperName = scraper.name || scraper.constructor?.name || 'unknown';

      if (result.status === 'fulfilled') {
        const workerResult = result.value;
        if (workerResult.success && workerResult.results) {
          allResults.push(...workerResult.results);
          scraperStatus[scraperName] = {
            status: 'completed',
            results: workerResult.results.length,
            error: null
          };
        } else {
          scraperStatus[scraperName] = {
            status: 'error',
            results: 0,
            error: workerResult.error || 'Unknown error'
          };
        }
      } else {
        scraperStatus[scraperName] = {
          status: 'error',
          results: 0,
          error: result.reason?.message || 'Worker failed'
        };
      }
    });

    return {
      results: allResults,
      scraperStatus
    };
  }

  /**
   * Get current worker statistics
   * @returns {Object} - Worker statistics
   */
  getStats() {
    return {
      activeWorkers: this.activeWorkers.size,
      maxWorkers: this.maxWorkers,
      workerIds: Array.from(this.activeWorkers.keys())
    };
  }

  /**
   * Cleanup all workers
   */
  async cleanup() {
    logger.info('Cleaning up workers', { count: this.activeWorkers.size });
    const terminatePromises = Array.from(this.activeWorkers.values()).map(worker =>
      worker.terminate()
    );
    await Promise.all(terminatePromises);
    this.activeWorkers.clear();
  }
}

module.exports = WorkerManager;
