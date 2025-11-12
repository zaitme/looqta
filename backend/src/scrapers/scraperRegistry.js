/**
 * Simple registry pattern for scrapers.
 * Add new scrapers under src/scrapers/ and register here.
 */
const amazon = require('./amazon');
const noon = require('./noon');
const jarir = require('./jarir');
const extra = require('./extra');
const panda = require('./panda');
const db = require('../db/mysql');
const logger = require('../utils/logger');

// Scraper settings cache (loaded from database)
let scraperSettings = {
  amazon: { enabled: true },
  noon: { enabled: true },
  jarir: { enabled: true },
  panda: { enabled: true },
  extra: { enabled: process.env.DISABLE_EXTRA_SCRAPER !== 'true' }
};

// Load scraper settings from database
async function loadScraperSettings() {
  try {
    const [configs] = await db.execute('SELECT * FROM scraper_configs');
    const settings = {};
    
    configs.forEach(config => {
      settings[config.scraper_name] = {
        enabled: config.enabled === 1,
        timeout_ms: config.timeout_ms,
        max_retries: config.max_retries,
        retry_delay_ms: config.retry_delay_ms,
        max_results: config.max_results,
        rate_limit_per_sec: parseFloat(config.rate_limit_per_sec),
        concurrency: config.concurrency,
        custom_domain: config.custom_domain,
        user_agent: config.user_agent,
        extra_config: config.extra_config ? JSON.parse(config.extra_config) : null,
        display_name: config.display_name
      };
    });
    
    scraperSettings = { ...scraperSettings, ...settings };
    logger.info('Scraper settings loaded from database', { count: configs.length });
  } catch (error) {
    // If table doesn't exist or DB unavailable, use defaults
    logger.warn('Failed to load scraper settings from database, using defaults', { error: error.message });
  }
}

// Initialize on module load
loadScraperSettings().catch(err => {
  logger.warn('Initial scraper settings load failed, using defaults', { error: err.message });
});

/**
 * Update scraper settings (in-memory cache)
 */
function updateScraperSettings(settings) {
  scraperSettings = { ...scraperSettings, ...settings };
}

/**
 * Get scraper settings
 */
function getScraperSettings() {
  return { ...scraperSettings };
}

/**
 * Get scraper configuration for a specific scraper
 */
function getScraperConfig(scraperName) {
  return scraperSettings[scraperName] || { enabled: false };
}

function getActiveScrapers(){
  // Return all active scrapers for KSA e-commerce sites
  // Filter by enabled status
  const allScrapers = [
    { scraper: amazon, name: 'amazon' },
    { scraper: noon, name: 'noon' },
    { scraper: jarir, name: 'jarir' },
    { scraper: panda, name: 'panda' },
    { scraper: extra, name: 'extra' }
  ];
  
  // Filter by enabled status
  const activeScrapers = allScrapers
    .filter(({ name }) => {
      // Check admin settings first
      if (scraperSettings[name]?.enabled === false) {
        return false;
      }
      // Extra scraper also checks environment variable
      if (name === 'extra' && process.env.DISABLE_EXTRA_SCRAPER === 'true') {
        return false;
      }
      return true;
    })
    .map(({ scraper }) => scraper);
  
  return activeScrapers;
}

/**
 * Get all scrapers (for iteration)
 */
function getAllScrapers() {
  return getActiveScrapers();
}

/**
 * Get scraper by site name
 * @param {string} site - Site name or domain
 * @returns {Object|null} Scraper instance or null
 */
function getScraper(site) {
  const scrapers = getActiveScrapers();
  const normalizedSite = site.toLowerCase();
  
  return scrapers.find(s => {
    if (!s.site) return false;
    const scraperSite = s.site.toLowerCase();
    return scraperSite.includes(normalizedSite) || normalizedSite.includes(scraperSite);
  }) || null;
}

module.exports = { 
  getActiveScrapers,
  getAllScrapers,
  getScraper,
  updateScraperSettings,
  getScraperSettings,
  getScraperConfig,
  loadScraperSettings
};
