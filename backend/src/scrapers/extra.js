/**
 * Extra scraper (extra.com/en-sa/)
 * Major KSA e-commerce site for electronics and appliances
 */

const puppeteer = require('puppeteer');
const logger = require('../utils/logger');
const { setupChromeEnvironment, getChromeLaunchOptions } = require('../utils/chrome-deps-fix');
const { validateResults } = require('../utils/result-validator');
const { safeCloseBrowser, safeClosePage, retryWithBackoff, classifyError } = require('../utils/scraper-helpers');

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MAX_RESULTS = 8;

// Get Chrome executable path
function getChromeExecutablePath() {
  const fs = require('fs');
  const puppeteer = require('puppeteer');
  const bundledPath = puppeteer.executablePath();
  
  if (fs.existsSync(bundledPath)) {
    logger.info('Using Puppeteer bundled Chrome', { path: bundledPath });
    return bundledPath;
  }
  
  const possiblePaths = [
    '/opt/google/chrome/chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ];
  
  for (const chromePath of possiblePaths) {
    if (fs.existsSync(chromePath)) {
      logger.warn('Using system Chrome as fallback', { path: chromePath });
      return chromePath;
    }
  }
  
  logger.error('No Chrome executable found!');
  return undefined;
}

setupChromeEnvironment();
const CHROME_EXECUTABLE = getChromeExecutablePath();
const LAUNCH_OPTIONS = getChromeLaunchOptions({
  executablePath: CHROME_EXECUTABLE
});

logger.info('Extra scraper initialized', { 
  chromeExecutable: CHROME_EXECUTABLE,
  headless: LAUNCH_OPTIONS.headless 
});

async function parseResults(page) {
  let results;
  
  try {
    // Extra product structure - try multiple selector strategies
    results = await page.evaluate(() => {
      // Try multiple selectors for Extra's product cards
      let productCards = Array.from(document.querySelectorAll('.product-item, .product-card, .product-tile, [class*="ProductCard"], [data-testid*="product"], [class*="product-card"]'));
      
      // If no results, try alternative selectors
      if (productCards.length === 0) {
        productCards = Array.from(document.querySelectorAll('div[class*="Product"], article, [class*="item"], [class*="card"], [data-product-id]'));
      }
      
      const items = [];
      
      productCards.slice(0, 20).forEach(card => {
        try {
          // Find product name - try multiple selectors
          let titleEl = card.querySelector('h2, h3, .product-title, .product-name, [class*="title"], [class*="name"], a[href*="/product"]');
          if (!titleEl) {
            titleEl = card.querySelector('a[href*="/product"], a[href*="/p/"]');
          }
          const productName = titleEl ? (titleEl.innerText || titleEl.textContent || titleEl.getAttribute('title') || '').trim() : null;
          
          // Find product URL
          let urlEl = card.querySelector('a[href*="/product"], a[href*="/p/"], .product-link, h2 a, h3 a, a[href*="extra.com"]');
          if (!urlEl && titleEl && titleEl.tagName === 'A') {
            urlEl = titleEl;
          }
          let productUrl = null;
          if (urlEl && urlEl.href) {
            productUrl = urlEl.href;
            try {
              const urlObj = new URL(productUrl);
              productUrl = `${urlObj.origin}${urlObj.pathname}`;
            } catch (e) {
              // Invalid URL
            }
          }
          
          // Find price - try multiple selectors
          let priceEl = card.querySelector('.price, .product-price, [class*="price"], .amount, [class*="Price"], [data-testid*="price"], [data-price], [class*="amount"]');
          if (!priceEl) {
            // Try to find price in text content
            const cardText = card.innerText || card.textContent || '';
            const priceMatch = cardText.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(SAR|ريال|ر\.س)/i);
            if (priceMatch) {
              priceEl = { innerText: priceMatch[1] + ' ' + priceMatch[2] };
            }
          }
          let priceText = null;
          if (priceEl) {
            priceText = priceEl.innerText || priceEl.textContent || priceEl.getAttribute('data-price') || '';
          }
          
          // Find image - try multiple sources
          let imageEl = card.querySelector('img[src*="extra"], img.product-image, img[class*="product"], img[data-src*="extra"], img');
          let imageUrl = null;
          if (imageEl) {
            imageUrl = imageEl.getAttribute('data-src') || 
                      imageEl.getAttribute('data-lazy-src') || 
                      imageEl.getAttribute('srcset')?.split(',')[0]?.trim().split(' ')[0] ||
                      imageEl.src;
            // Ensure full URL
            if (imageUrl && !imageUrl.startsWith('http')) {
              imageUrl = 'https:' + imageUrl;
            }
          }
          
          if (productName && productName.length > 3) {
            items.push({
              product_name: productName,
              url: productUrl,
              price_text: priceText,
              image: imageUrl
            });
          }
        } catch (e) {
          // Skip invalid cards
        }
      });
      
      return { items, totalFound: productCards.length };
    });
  } catch (e) {
    logger.debug('Extra selector failed', { error: e.message });
    return [];
  }
  
  logger.debug('Extra scraper found items', { 
    totalFound: results.totalFound, 
    parsed: results.items.length 
  });
  
  // Normalize results - be more lenient with price requirement
  return results.items.filter(r => r.product_name && r.product_name.length > 3).slice(0, MAX_RESULTS).map(r => {
    // Extract price - handle multiple formats
    let price = null;
    if (r.price_text) {
      const clean = r.price_text.replace(/[^0-9.,]/g, '').replace(/,/g, '');
      price = parseFloat(clean) || null;
    }
    
    return {
      product_name: r.product_name,
      site: 'extra.com',
      price: price,
      currency: 'SAR',
      url: r.url,
      image: r.image || null,
      raw: r
    };
  });
  
  // Validate results to filter out invalid items
  const validated = validateResults(normalized, 'extra');
  
  logger.debug('Extra validation', { 
    beforeValidation: normalized.length,
    afterValidation: validated.length,
    filtered: normalized.length - validated.length
  });
  
  return validated.slice(0, MAX_RESULTS);
}

async function search(query) {
  // Check if Extra scraper is disabled via environment variable
  if (process.env.DISABLE_EXTRA_SCRAPER === 'true') {
    logger.debug('Extra scraper is disabled via DISABLE_EXTRA_SCRAPER environment variable');
    return [];
  }

  const searchUrl = `https://www.extra.com/en-sa/search?q=${encodeURIComponent(query)}`;
  
  try {
    // Wrap in retry logic for transient failures
    // Extra scraper has frequent protocol timeouts, so use longer delays
    return await retryWithBackoff(async () => {
      return await performSearch(query, searchUrl);
    }, {
      maxRetries: 2,
      initialDelay: 2000, // Longer initial delay for Extra
      maxDelay: 15000,
      retryableErrors: ['timeout', 'ECONNRESET', 'ETIMEDOUT', 'protocol timeout', 'Runtime.callFunctionOn']
    });
  } catch (error) {
    const errorInfo = classifyError(error);
    logger.error('Extra scraper failed', { 
      query, 
      error: error.message,
      errorType: errorInfo.type,
      retryable: errorInfo.retryable,
      stack: error.stack 
    });
    return [];
  }
}

async function performSearch(query, searchUrl) {
  let browser, page;
  try {
    logger.debug('Starting Extra scraper', { query, url: searchUrl });
    
    const launchOpts = { ...LAUNCH_OPTIONS };
    delete launchOpts.timeout;
    
    browser = await puppeteer.launch({
      ...launchOpts,
      timeout: 90000,
      protocolTimeout: 180000,
      dumpio: process.env.DEBUG_CHROME === 'true',
      ignoreHTTPSErrors: true,
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false
    });
    
    page = await browser.newPage();
    await page.setUserAgent(process.env.PUPPETEER_USER_AGENT || DEFAULT_USER_AGENT);
    await page.setViewport({ width: 1280, height: 800 });
    
    logger.debug('Navigating to Extra search page', { query });
    
    try {
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (navError) {
      // Check for DNS resolution errors
      if (navError.message && (
        navError.message.includes('ERR_NAME_NOT_RESOLVED') ||
        navError.message.includes('net::ERR_NAME_NOT_RESOLVED') ||
        navError.message.includes('DNS_PROBE_FINISHED_NXDOMAIN')
      )) {
        logger.warn('Extra scraper: Domain not found, skipping scraper', { 
          query, 
          url: searchUrl,
          error: navError.message 
        });
        return [];
      }
      // Re-throw other navigation errors
      throw navError;
    }
    
    // Wait for results - try multiple selectors
    try {
      await page.waitForSelector('.product-item, .product-card, [class*="product"], [data-testid*="product"]', { timeout: 20000 });
    } catch (e) {
      try {
        await page.waitForSelector('div[class*="Product"], article, [class*="item"]', { timeout: 15000 });
      } catch (e2) {
        logger.debug('Extra results selector not found, continuing...');
      }
    }
    
    // Wait for dynamic content
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Scroll to load more products
    for (let i = 0; i < 2; i++) {
      await page.evaluate((index) => {
        window.scrollTo(0, document.body.scrollHeight * (index + 1) / 3);
      }, i);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    const results = await parseResults(page);
    
    logger.info('Extra scraper completed successfully', { query, resultCount: results.length });
    return results;
    
  } catch (error) {
    // Check for DNS resolution errors - don't retry these
    if (error.message && (
      error.message.includes('ERR_NAME_NOT_RESOLVED') ||
      error.message.includes('net::ERR_NAME_NOT_RESOLVED') ||
      error.message.includes('DNS_PROBE_FINISHED_NXDOMAIN') ||
      error.message.includes('Could not resolve host')
    )) {
      logger.warn('Extra scraper: Domain resolution failed, skipping scraper', { 
        query, 
        url: searchUrl,
        error: error.message 
      });
      // Return empty array for DNS errors (non-retryable)
      return [];
    }
    
    // Re-throw other errors to be handled by retry logic
    throw error;
  } finally {
    // Always close page and browser, even on error
    await safeClosePage(page, 'extra');
    await safeCloseBrowser(browser, 'extra');
  }
}

module.exports = {
  name: 'extra',
  site: 'extra.com',
  search
};
