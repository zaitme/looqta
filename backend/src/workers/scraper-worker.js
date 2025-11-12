/**
 * Worker thread for running scrapers in isolation
 * This allows true parallelism for CPU-intensive scraping tasks
 */

const { parentPort, workerData } = require('worker_threads');
const logger = require('../utils/logger');

// Import scrapers dynamically
let scraperModule = null;

async function runScraper() {
  try {
    const { scraperName, query, scraperPath } = workerData;
    
    logger.debug(`Worker thread starting scraper: ${scraperName}`, { query });
    
    // Dynamically import the scraper module
    scraperModule = require(scraperPath);
    
    if (!scraperModule || typeof scraperModule.search !== 'function') {
      throw new Error(`Scraper ${scraperName} does not export a search function`);
    }
    
    // Run the scraper
    const results = await scraperModule.search(query);
    
    // Send results back to main thread
    parentPort.postMessage({
      success: true,
      scraperName,
      results: results || [],
      resultCount: results ? results.length : 0
    });
    
  } catch (error) {
    logger.error('Worker thread error', {
      scraperName: workerData?.scraperName,
      error: error.message,
      stack: error.stack
    });
    
    // Send error back to main thread
    parentPort.postMessage({
      success: false,
      scraperName: workerData?.scraperName,
      error: error.message,
      results: []
    });
  }
}

// Start the scraper when worker receives data
runScraper();
