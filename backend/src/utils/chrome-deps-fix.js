/**
 * Chrome dependencies fix utility
 * Attempts to install missing Chrome dependencies or provide workarounds
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * Check if Chrome can launch by testing the executable
 */
function checkChromeDependencies() {
  try {
    const puppeteer = require('puppeteer');
    const chromePath = puppeteer.executablePath();
    
    if (!fs.existsSync(chromePath)) {
      logger.warn('Chrome executable not found', { path: chromePath });
      return false;
    }
    
    // Try to check library dependencies
    try {
      const lddOutput = execSync(`ldd "${chromePath}" 2>&1 || true`, { encoding: 'utf-8' });
      const missingLibs = lddOutput.split('\n')
        .filter(line => line.includes('not found'))
        .map(line => line.trim().split(' ')[0]);
      
      if (missingLibs.length > 0) {
        logger.warn('Missing Chrome dependencies detected', { 
          missing: missingLibs,
          chromePath 
        });
        return false;
      }
    } catch (e) {
      // ldd might not be available, continue anyway
      logger.debug('Could not check dependencies with ldd', { error: e.message });
    }
    
    return true;
  } catch (e) {
    logger.error('Error checking Chrome dependencies', { error: e.message });
    return false;
  }
}

/**
 * Try to fix Chrome launch by setting environment variables
 */
function setupChromeEnvironment() {
  // Set library paths
  const libPaths = [
    '/usr/lib/x86_64-linux-gnu',
    '/usr/lib64',
    '/lib/x86_64-linux-gnu',
    '/lib64',
    process.env.LD_LIBRARY_PATH || ''
  ].filter(Boolean);
  
  process.env.LD_LIBRARY_PATH = libPaths.join(':');
  
  // Disable sandbox if not available
  process.env.CHROME_DEVEL_SANDBOX = '';
  
  // Set display for headless
  if (!process.env.DISPLAY) {
    process.env.DISPLAY = ':99';
  }
  
  logger.debug('Chrome environment configured', { 
    LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH,
    DISPLAY: process.env.DISPLAY
  });
}

/**
 * Get launch options with fallbacks
 */
function getChromeLaunchOptions(customOptions = {}) {
  setupChromeEnvironment();
  
  const defaultOptions = {
    headless: true, // Use standard headless mode for better compatibility
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-client-side-phishing-detection',
      '--disable-component-update',
      '--disable-default-apps',
      '--disable-domain-reliability',
      '--disable-features=AudioServiceOutOfProcess',
      '--disable-hang-monitor',
      '--disable-ipc-flooding-protection',
      '--disable-notifications',
      '--disable-offer-store-unmasked-wallet-cards',
      '--disable-popup-blocking',
      '--disable-print-preview',
      '--disable-prompt-on-repost',
      '--disable-renderer-backgrounding',
      '--disable-speech-api',
      '--disable-sync',
      '--disable-translate',
      '--disable-windows10-custom-titlebar',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-default-browser-check',
      '--no-first-run',
      '--no-pings',
      '--no-zygote',
      '--safebrowsing-disable-auto-update',
      '--enable-automation',
      '--password-store=basic',
      '--use-mock-keychain',
      '--disable-xss-auditor',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--remote-debugging-port=0', // Use random port to avoid conflicts
      '--disable-background-networking',
      '--disable-sync',
      '--disable-translate',
      '--hide-scrollbars',
      '--mute-audio',
      '--no-first-run',
      '--disable-default-apps',
      '--disable-infobars'
    ]
  };
  
  return { ...defaultOptions, ...customOptions };
}

module.exports = {
  checkChromeDependencies,
  setupChromeEnvironment,
  getChromeLaunchOptions
};
