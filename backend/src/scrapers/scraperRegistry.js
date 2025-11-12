/**
 * Simple registry pattern for scrapers.
 * Add new scrapers under src/scrapers/ and register here.
 */
const amazon = require('./amazon');
const noon = require('./noon');
const jarir = require('./jarir');
const extra = require('./extra');
const panda = require('./panda');

// Scraper settings (can be updated via admin API)
let scraperSettings = {
  amazon: { enabled: true },
  noon: { enabled: true },
  jarir: { enabled: true },
  panda: { enabled: true },
  extra: { enabled: process.env.DISABLE_EXTRA_SCRAPER !== 'true' }
};

/**
 * Update scraper settings
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

module.exports = { 
  getActiveScrapers,
  updateScraperSettings,
  getScraperSettings
};
