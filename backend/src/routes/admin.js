/**
 * Admin API routes for managing scrapers and system settings
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const cache = require('../cache/redis');
const registry = require('../scrapers/scraperRegistry');

/**
 * Get all scrapers and their status
 */
router.get('/scrapers', async (req, res) => {
  try {
    const settings = registry.getScraperSettings();
    const allScrapers = [
      { name: 'amazon', displayName: 'Amazon', enabled: settings.amazon?.enabled !== false },
      { name: 'noon', displayName: 'Noon', enabled: settings.noon?.enabled !== false },
      { name: 'jarir', displayName: 'Jarir', enabled: settings.jarir?.enabled !== false },
      { name: 'panda', displayName: 'Panda', enabled: settings.panda?.enabled !== false },
      { name: 'extra', displayName: 'Extra', enabled: settings.extra?.enabled !== false }
    ];
    
    res.json({ success: true, scrapers: allScrapers });
  } catch (error) {
    logger.error('Admin: Error getting scrapers', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update scraper settings
 */
router.post('/scrapers', async (req, res) => {
  try {
    const { scrapers } = req.body;
    
    if (!scrapers || typeof scrapers !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid scrapers data' });
    }
    
    // Update scraper settings in registry
    const settings = {};
    Object.keys(scrapers).forEach(scraperName => {
      if (['amazon', 'noon', 'jarir', 'panda', 'extra'].includes(scraperName)) {
        settings[scraperName] = { enabled: scrapers[scraperName] === true };
        logger.info('Admin: Updated scraper setting', { 
          scraper: scraperName, 
          enabled: settings[scraperName].enabled 
        });
      }
    });
    
    registry.updateScraperSettings(settings);
    const updatedSettings = registry.getScraperSettings();
    
    res.json({ success: true, scrapers: updatedSettings });
  } catch (error) {
    logger.error('Admin: Error updating scrapers', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get cache statistics
 */
router.get('/cache/stats', async (req, res) => {
  try {
    // Check if Redis is connected by trying a simple command
    let connected = false;
    try {
      await cache.ping();
      connected = true;
    } catch (e) {
      connected = false;
    }
    
    res.json({ 
      success: true, 
      cache: {
        connected: connected
      }
    });
  } catch (error) {
    logger.error('Admin: Error getting cache stats', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Clear cache
 */
router.post('/cache/clear', async (req, res) => {
  try {
    const { pattern } = req.body;
    
    if (pattern) {
      // Clear specific pattern
      const keys = await cache.keys(pattern);
      if (keys && keys.length > 0) {
        await Promise.all(keys.map(key => cache.del(key)));
        logger.info('Admin: Cleared cache pattern', { pattern, count: keys.length });
        res.json({ success: true, message: `Cleared ${keys.length} cache entries`, pattern });
      } else {
        res.json({ success: true, message: 'No cache entries found', pattern });
      }
    } else {
      // Clear all search cache
      const keys = await cache.keys('search:*');
      if (keys && keys.length > 0) {
        await Promise.all(keys.map(key => cache.del(key)));
        logger.info('Admin: Cleared all search cache', { count: keys.length });
        res.json({ success: true, message: `Cleared ${keys.length} cache entries` });
      } else {
        res.json({ success: true, message: 'No cache entries found' });
      }
    }
  } catch (error) {
    logger.error('Admin: Error clearing cache', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get system stats
 */
router.get('/stats', async (req, res) => {
  try {
    const settings = registry.getScraperSettings();
    const activeScrapers = registry.getActiveScrapers();
    const allScrapers = [
      { scraper: require('../scrapers/amazon'), name: 'amazon' },
      { scraper: require('../scrapers/noon'), name: 'noon' },
      { scraper: require('../scrapers/jarir'), name: 'jarir' },
      { scraper: require('../scrapers/panda'), name: 'panda' },
      { scraper: require('../scrapers/extra'), name: 'extra' }
    ];
    
    res.json({
      success: true,
      stats: {
        totalScrapers: allScrapers.length,
        enabledScrapers: activeScrapers.length,
        disabledScrapers: allScrapers.length - activeScrapers.length,
        scrapers: allScrapers.map(({ name }) => ({
          name,
          enabled: settings[name]?.enabled !== false
        }))
      }
    });
  } catch (error) {
    logger.error('Admin: Error getting stats', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
