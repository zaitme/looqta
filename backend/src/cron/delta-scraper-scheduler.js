/**
 * Delta Scraper Scheduler
 * Implements PHASE 3: High-Efficiency Cron Strategy
 * 
 * Schedules prioritized scraping based on product tiers (HOT/WARM/COLD)
 */

const schedule = require('node-schedule');
const logger = require('../utils/logger');
const jobQueue = require('../utils/job-queue');
const { 
  flushMetricsToDatabase, 
  updateTiers, 
  getProductsForScraping,
  updateLastScrapedAt
} = require('../utils/product-metrics');
const registry = require('../scrapers/scraperRegistry');
const { validateRecords } = require('../utils/product-validation');
const { upsertProductsBatch } = require('../utils/product-upsert');
const { logPriceHistory } = require('../utils/price-history');

/**
 * Scrape a single product
 */
async function scrapeProduct(product) {
  const { site, site_product_id, url, product_id } = product;
  
  if (!site || !url) {
    logger.warn('Invalid product for scraping', { product_id });
    return null;
  }
  
  try {
    // Find scraper for this site
    const scrapers = registry.getActiveScrapers();
    const scraper = scrapers.find(s => {
      const name = (s.name || '').toLowerCase();
      return name.includes(site.toLowerCase());
    });
    
    if (!scraper) {
      logger.warn('No scraper found for site', { site, product_id });
      return null;
    }
    
    // Extract search query from product name or URL
    // For now, we'll need to store the original query or product name
    // This is a simplified version - in production, you'd want to scrape the product page directly
    logger.debug('Scraping product', { site, product_id });
    
    // Note: This is a placeholder - actual implementation would need product-specific scraping
    // For now, we'll update last_scraped_at to mark it as attempted
    await updateLastScrapedAt(product_id);
    
    return null; // Placeholder
    
  } catch (error) {
    logger.error('Product scrape failed', {
      product_id,
      site,
      error: error.message
    });
    return null;
  }
}

/**
 * Process delta scrape job for a tier
 */
async function processDeltaScrapeJob(data) {
  const { tier, productIds } = data;
  logger.info('Processing delta scrape job', { tier, productCount: productIds.length });
  
  try {
    // Get products for scraping
    const intervalHours = tier === 'HOT' ? 1 : tier === 'WARM' ? 4 : 24;
    const products = await getProductsForScraping(tier, intervalHours, 50);
    
    if (products.length === 0) {
      logger.debug('No products to scrape for tier', { tier });
      return;
    }
    
    // Scrape products (in batches)
    const batchSize = 5;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const scrapePromises = batch.map(product => scrapeProduct(product));
      await Promise.allSettled(scrapePromises);
      
      // Small delay between batches to avoid overwhelming scrapers
      if (i + batchSize < products.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    logger.info('Delta scrape job completed', { tier, processed: products.length });
    
  } catch (error) {
    logger.error('Delta scrape job failed', {
      tier,
      error: error.message,
      stack: error.stack
    });
  }
}

// Register job processor
jobQueue.registerProcessor('delta_scrape', processDeltaScrapeJob);

/**
 * Scheduled job: Flush metrics and update tiers
 * Runs every hour
 */
function scheduleMetricsFlush() {
  schedule.scheduleJob('0 * * * *', async () => {
    logger.info('Running scheduled metrics flush');
    try {
      await flushMetricsToDatabase();
      await updateTiers();
      logger.info('Metrics flush completed');
    } catch (error) {
      logger.error('Scheduled metrics flush failed', {
        error: error.message
      });
    }
  });
}

/**
 * Scheduled job: Delta scrape for HOT products
 * Runs every hour
 */
function scheduleHotScraping() {
  schedule.scheduleJob('0 * * * *', async () => {
    logger.info('Running scheduled HOT product scraping');
    try {
      const products = await getProductsForScraping('HOT', 1, 100);
      if (products.length > 0) {
        const productIds = products.map(p => p.product_id);
        jobQueue.add('delta_scrape', { tier: 'HOT', productIds }, { priority: 10 });
        logger.info('Queued HOT scraping job', { productCount: products.length });
      }
    } catch (error) {
      logger.error('Scheduled HOT scraping failed', { error: error.message });
    }
  });
}

/**
 * Scheduled job: Delta scrape for WARM products
 * Runs every 4 hours
 */
function scheduleWarmScraping() {
  schedule.scheduleJob('0 */4 * * *', async () => {
    logger.info('Running scheduled WARM product scraping');
    try {
      const products = await getProductsForScraping('WARM', 4, 200);
      if (products.length > 0) {
        const productIds = products.map(p => p.product_id);
        jobQueue.add('delta_scrape', { tier: 'WARM', productIds }, { priority: 5 });
        logger.info('Queued WARM scraping job', { productCount: products.length });
      }
    } catch (error) {
      logger.error('Scheduled WARM scraping failed', { error: error.message });
    }
  });
}

/**
 * Scheduled job: Delta scrape for COLD products
 * Runs daily at 2 AM
 */
function scheduleColdScraping() {
  schedule.scheduleJob('0 2 * * *', async () => {
    logger.info('Running scheduled COLD product scraping');
    try {
      const products = await getProductsForScraping('COLD', 24, 500);
      if (products.length > 0) {
        const productIds = products.map(p => p.product_id);
        jobQueue.add('delta_scrape', { tier: 'COLD', productIds }, { priority: 1 });
        logger.info('Queued COLD scraping job', { productCount: products.length });
      }
    } catch (error) {
      logger.error('Scheduled COLD scraping failed', { error: error.message });
    }
  });
}

/**
 * Start all scheduled jobs
 */
function start() {
  scheduleMetricsFlush();
  scheduleHotScraping();
  scheduleWarmScraping();
  scheduleColdScraping();
  logger.info('Delta scraper scheduler started');
}

/**
 * Stop all scheduled jobs
 */
function stop() {
  schedule.gracefulShutdown();
  logger.info('Delta scraper scheduler stopped');
}

module.exports = {
  start,
  stop,
  scheduleMetricsFlush,
  scheduleHotScraping,
  scheduleWarmScraping,
  scheduleColdScraping
};
