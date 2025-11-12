/**
 * Amazon scraper adapter (puppeteer-based)
 * This implementation performs a search on amazon.sa and parses the first N results.
 *
 * Notes:
 * - Uses headless Puppeteer. In Docker, puppeteer is launched with --no-sandbox --disable-setuid-sandbox.
 * - Be mindful of Amazon's Terms of Service and robots.txt. Use responsibly.
 */

const puppeteer = require('puppeteer');
const logger = require('../utils/logger');
const { setupChromeEnvironment, getChromeLaunchOptions } = require('../utils/chrome-deps-fix');
const { validateResults } = require('../utils/result-validator');
const { safeCloseBrowser, safeClosePage, retryWithBackoff, classifyError } = require('../utils/scraper-helpers');

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MAX_RESULTS = 8;
const AMAZON_DOMAIN = process.env.AMAZON_DOMAIN || 'amazon.sa'; // Default to amazon.sa

// Get Chrome executable path - try to use system Chrome if available
function getChromeExecutablePath() {
  const fs = require('fs');
  const path = require('path');
  
  // Use Puppeteer's bundled Chrome - it's designed to work with Puppeteer
  // System Chrome has issues with WebSocket endpoint detection
  const puppeteer = require('puppeteer');
  const bundledPath = puppeteer.executablePath();
  
  if (fs.existsSync(bundledPath)) {
    logger.info('Using Puppeteer bundled Chrome', { path: bundledPath });
    return bundledPath;
  }
  
  // Fallback to system Chrome if bundled not available
  const possiblePaths = [
    '/opt/google/chrome/chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ];
  
  for (const chromePath of possiblePaths) {
    if (fs.existsSync(chromePath)) {
      logger.warn('Using system Chrome as fallback (may have issues)', { path: chromePath });
      return chromePath;
    }
  }
  
  logger.error('No Chrome executable found!');
  return undefined;
}

// Setup Chrome environment before creating launch options
setupChromeEnvironment();

// Get executable path once at module load
const CHROME_EXECUTABLE = getChromeExecutablePath();

const LAUNCH_OPTIONS = getChromeLaunchOptions({
  executablePath: CHROME_EXECUTABLE
});

// Log the configuration
logger.info('Amazon scraper initialized', { 
  chromeExecutable: CHROME_EXECUTABLE,
  headless: LAUNCH_OPTIONS.headless 
});

async function parseResults(page){
  // Amazon search result items container - try multiple selector strategies
  let results;
  
  try {
    // Primary selector strategy
    results = await page.$$eval('div.s-main-slot div[data-component-type="s-search-result"]', items => {
      return {
        items: items.slice(0, 12).map(item => {
          // Find title - try multiple selectors, prioritize full title
          let titleEl = item.querySelector('h2 a');
          let productName = null;
          if (titleEl) {
            // Get full title from link's aria-label, title attribute, or innerText
            productName = titleEl.getAttribute('aria-label') || 
                         titleEl.getAttribute('title') || 
                         titleEl.innerText || 
                         titleEl.textContent;
            // If still not found, try span inside
            if (!productName || productName.length < 10) {
              const spanEl = titleEl.querySelector('span');
              if (spanEl) {
                productName = spanEl.innerText || spanEl.textContent;
              }
            }
          }
          if (!productName || productName.length < 10) {
            titleEl = item.querySelector('h2 span');
            if (titleEl) productName = titleEl.innerText || titleEl.textContent;
          }
          if (!productName || productName.length < 10) {
            titleEl = item.querySelector('[data-cy="title-recipe"] span');
            if (titleEl) productName = titleEl.innerText || titleEl.textContent;
          }
          if (!productName || productName.length < 10) {
            titleEl = item.querySelector('h2');
            if (titleEl) productName = titleEl.innerText || titleEl.textContent;
          }
          // Fallback: try to get from any link with product URL
          if (!productName || productName.length < 10) {
            const productLink = item.querySelector('a[href*="/dp/"], a[href*="/gp/product/"]');
            if (productLink) {
              productName = productLink.getAttribute('aria-label') || 
                           productLink.getAttribute('title') || 
                           productLink.innerText || 
                           productLink.textContent;
            }
          }
          
          // Find URL - prioritize product links
          let urlEl = item.querySelector('h2 a');
          if (!urlEl || !urlEl.href) urlEl = item.querySelector('a[href*="/dp/"]');
          if (!urlEl || !urlEl.href) urlEl = item.querySelector('a[href*="/gp/product/"]');
          if (!urlEl || !urlEl.href) {
            // Try to find any link within the item
            const allLinks = item.querySelectorAll('a[href]');
            for (const link of allLinks) {
              if (link.href && (link.href.includes('/dp/') || link.href.includes('/gp/product/'))) {
                urlEl = link;
                break;
              }
            }
          }
          // Last resort: find any link
          if (!urlEl || !urlEl.href) {
            urlEl = item.querySelector('a[href]');
          }
          
          const priceWhole = item.querySelector('.a-price .a-price-whole, .a-price-whole');
          const priceFrac = item.querySelector('.a-price .a-price-fraction, .a-price-fraction');
          const currencyEl = item.querySelector('.a-price .a-price-symbol, .a-price-symbol');
          const seller = item.querySelector('.a-size-base-plus.a-color-secondary, [data-cy="title-recipe"]');
          
          // Also try to get product name from h2 title span if productName is still short
          if (!productName || productName.length < 10 || productName.toLowerCase() === 'sponsored') {
            // Try to get from h2 title element directly
            const h2Title = item.querySelector('h2');
            if (h2Title) {
              const h2Text = h2Title.innerText || h2Title.textContent || '';
              if (h2Text && h2Text.length > 10 && h2Text.toLowerCase() !== 'sponsored') {
                productName = h2Text.trim();
              }
            }
          }
          
          // Find product image
          let imageEl = item.querySelector('img[data-image-latency="s-product-image"]');
          if (!imageEl) imageEl = item.querySelector('img.s-image');
          if (!imageEl) imageEl = item.querySelector('img[src*="images-amazon"]');
          if (!imageEl) imageEl = item.querySelector('img');
          
          // Try alternative price selectors
          let priceText = null;
          if (priceWhole) {
            priceText = priceWhole.innerText + (priceFrac ? '.'+priceFrac.innerText : '');
          } else {
            const priceSpan = item.querySelector('.a-price, [class*="price"]');
            if (priceSpan) {
              priceText = priceSpan.innerText || priceSpan.textContent || '';
            }
          }
          
          // Skip sponsored/ads - they often don't have proper URLs
          // productName is already declared and extracted above (line 80)
          let productUrl = urlEl && urlEl.href ? urlEl.href : null;
          
          // Clean up URL - remove tracking parameters and fix invalid URLs
          if (productUrl) {
            try {
              const urlObj = new URL(productUrl);
              
              // Filter out invalid URLs (sponsored/ad click URLs)
              if (urlObj.pathname.includes('/sspa/click') || 
                  urlObj.pathname.includes('/sspa/') ||
                  urlObj.pathname === '/-/en/click' ||
                  !urlObj.pathname.includes('/dp/') && !urlObj.pathname.includes('/gp/product/')) {
                // Try to find a valid product URL in the item
                const validLinks = item.querySelectorAll('a[href*="/dp/"], a[href*="/gp/product/"]');
                if (validLinks.length > 0) {
                  productUrl = validLinks[0].href;
                  const validUrlObj = new URL(productUrl);
                  productUrl = `${validUrlObj.origin}${validUrlObj.pathname}`;
                } else {
                  productUrl = null; // No valid product URL found
                }
              } else {
                // Keep only essential parameters for valid product URLs
                productUrl = `${urlObj.origin}${urlObj.pathname}`;
              }
            } catch (e) {
              // Invalid URL, set to null
              productUrl = null;
            }
          }
          
          // Filter out sponsored items without proper product names
          // But allow items with valid product names even if URL is missing
          // If product name is "Sponsored" or too short, try to get real name from seller field
          if ((!productName || productName.length < 10 || productName.toLowerCase() === 'sponsored') && seller) {
            const sellerText = seller.innerText || seller.textContent || '';
            // Seller field often has format: "Brand\nFull Product Name" or just "Full Product Name"
            const lines = sellerText.split('\n').map(l => l.trim()).filter(l => l.length > 10);
            if (lines.length > 0) {
              // Try to find the longest line that looks like a product name
              const bestLine = lines.reduce((best, line) => {
                // Prefer lines that don't start with "Sponsored" and are longer
                if (line.toLowerCase().includes('sponsored')) return best;
                return line.length > (best?.length || 0) ? line : best;
              }, null);
              if (bestLine && bestLine.length > 10) {
                productName = bestLine;
              } else if (lines.length > 1 && lines[1].length > 10) {
                productName = lines[1]; // Usually the second line is the product name
              } else if (sellerText.length > 20) {
                productName = sellerText.trim();
              }
            }
          }
          
          // Final filter - remove items with invalid product names
          if (!productName || productName.length < 3 || productName.toLowerCase() === 'sponsored') {
            return null;
          }
          
          // Don't filter out items just because URL is missing - they might still be valid products
          
          // Extract image URL
          let imageUrl = null;
          if (imageEl) {
            imageUrl = imageEl.src || imageEl.getAttribute('data-src') || imageEl.getAttribute('data-lazy-src');
            // Clean up image URL - remove size parameters if present
            if (imageUrl && imageUrl.includes('._')) {
              // Amazon image URLs often have size parameters like ._AC_SL1500_
              // Try to get a higher resolution version
              imageUrl = imageUrl.replace(/\._AC_[^_]+_/, '._AC_SL1500_');
            }
          }
          
          return {
            product_name: productName ? productName.trim() : null,
            url: productUrl,
            price_text: priceText ? priceText.trim() : null,
            currency: currencyEl ? currencyEl.innerText.trim() : null,
            seller: seller ? seller.innerText.trim() : null,
            image: imageUrl
          };
        }),
        totalFound: items.length
      };
    });
    // Filter out null items (sponsored/ads) after evaluation
    results.items = results.items.filter(item => item !== null);
  } catch (e) {
    logger.debug('Primary Amazon selector failed, trying fallback', { error: e.message });
    // Fallback: try alternative selectors
    try {
      results = await page.$$eval('[data-component-type="s-search-result"], .s-result-item, [class*="s-result"]', items => {
        return {
          items: items.slice(0, 12).map(item => {
            const titleEl = item.querySelector('h2, h3, [class*="title"], a[href*="/dp/"] span');
            const urlEl = item.querySelector('a[href*="/dp/"], a[href*="/gp/product/"], h2 a, h3 a');
            const priceEl = item.querySelector('.a-price, [class*="price"], [class*="Price"]');
            
            let priceText = null;
            if (priceEl) {
              priceText = priceEl.innerText || priceEl.textContent || '';
            }
            
            // Try to get full product name from link
            let productName = null;
            if (urlEl) {
              productName = urlEl.getAttribute('aria-label') || 
                           urlEl.getAttribute('title') || 
                           urlEl.innerText || 
                           urlEl.textContent;
            }
            if (!productName || productName.length < 10) {
              productName = titleEl ? (titleEl.innerText || titleEl.textContent || '').trim() : null;
            }
            
            return {
              product_name: productName,
              url: urlEl ? urlEl.href : null,
              price_text: priceText ? priceText.trim() : null,
              currency: null,
              seller: null,
              image: null
            };
          }),
          totalFound: items.length
        };
      });
    } catch (e2) {
      logger.warn('All Amazon selectors failed', { error: e2.message });
      return [];
    }
  }
  
  logger.debug('Amazon scraper found items', { 
    totalFound: results.totalFound, 
    parsed: results.items.length 
  });
  
  const parsedItems = results.items;

  // Normalize parsed results - allow items without URLs but require name and price
  const normalized = parsedItems.filter(r => r.product_name && r.price_text && r.product_name.length > 3).slice(0, MAX_RESULTS * 2).map(r => {
    // remove non-numeric characters from price_text except dot and comma
    const clean = r.price_text.replace(/[^0-9.,]/g, '').replace(/,/g, '');
    const price = parseFloat(clean) || null;
    // Determine currency based on domain
    const currency = r.currency || (AMAZON_DOMAIN.includes('.sa') ? 'SAR' : 'AED');
    return {
      product_name: r.product_name,
      site: AMAZON_DOMAIN,
      price: price,
      currency: currency,
      url: r.url,
      image: r.image || null,
      raw: r
    };
  });
  
  // Validate results to filter out invalid items
  const validated = validateResults(normalized, 'amazon');
  
  logger.debug('Amazon validation', { 
    beforeValidation: normalized.length,
    afterValidation: validated.length,
    filtered: normalized.length - validated.length
  });
  
  return validated.slice(0, MAX_RESULTS);
}

async function search(query){
  const searchUrl = `https://www.${AMAZON_DOMAIN}/s?k=${encodeURIComponent(query)}`;
  let browser, page;
  try {
    // Wrap in retry logic for transient failures
    return await retryWithBackoff(async () => {
      return await performSearch(query, searchUrl);
    }, {
      maxRetries: 2,
      initialDelay: 1000,
      retryableErrors: ['timeout', 'ECONNRESET', 'ETIMEDOUT', 'protocol timeout']
    });
  } catch (error) {
    const errorInfo = classifyError(error);
    logger.error('Amazon scraper failed', { 
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
    logger.debug('Starting Amazon scraper', { 
      query, 
      url: searchUrl, 
      domain: AMAZON_DOMAIN,
      executablePath: LAUNCH_OPTIONS.executablePath,
      args: LAUNCH_OPTIONS.args?.length || 0
    });
    
    // Launch browser with explicit timeout and error handling
    // Remove timeout from LAUNCH_OPTIONS to avoid conflicts
    const launchOpts = { ...LAUNCH_OPTIONS };
    delete launchOpts.timeout; // Remove timeout from options, set it separately
    
    try {
      browser = await puppeteer.launch({
        ...launchOpts,
        timeout: 90000, // Increase to 90 seconds
        protocolTimeout: 180000,
        dumpio: process.env.DEBUG_CHROME === 'true', // Enable with DEBUG_CHROME=true
        ignoreHTTPSErrors: true,
        handleSIGINT: false,
        handleSIGTERM: false,
        handleSIGHUP: false
      });
      logger.debug('Browser launched successfully', { 
        browserVersion: await browser.version().catch(() => 'unknown')
      });
    } catch (launchError) {
      logger.error('Browser launch failed', {
        error: launchError.message,
        executablePath: LAUNCH_OPTIONS.executablePath,
        stack: launchError.stack
      });
      throw launchError;
    }
    page = await browser.newPage();
    await page.setUserAgent(process.env.PUPPETEER_USER_AGENT || DEFAULT_USER_AGENT);
    // set a reasonable viewport
    await page.setViewport({ width: 1280, height: 800 });

    logger.debug('Navigating to Amazon search page', { query });
    try {
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (navError) {
      // Check for DNS resolution errors or navigation timeouts
      if (navError.message && (
        navError.message.includes('ERR_NAME_NOT_RESOLVED') ||
        navError.message.includes('net::ERR_NAME_NOT_RESOLVED') ||
        navError.message.includes('DNS_PROBE_FINISHED_NXDOMAIN') ||
        navError.message.includes('Navigation timeout') ||
        navError.message.includes('timeout')
      )) {
        logger.warn('Amazon scraper: Navigation failed, skipping scraper', { 
          query, 
          url: searchUrl,
          error: navError.message 
        });
        return [];
      }
      // Re-throw other navigation errors
      throw navError;
    }

    // Wait for results container - Amazon may use different structures
    try {
      await page.waitForSelector('div.s-main-slot', { timeout: 15000 });
    } catch (e) {
      logger.warn('Amazon: Could not find s-main-slot container, trying alternatives', { query });
      // Try alternative selectors
      try {
        await page.waitForSelector('[data-component-type="s-search-result"], .s-result-item, .s-result-list', { timeout: 10000 });
      } catch (e2) {
        logger.warn('Amazon: Could not find any result containers', { query });
      }
    }

    // Wait a bit for dynamic content to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Scroll down to trigger lazy loading
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Debug: Log page content to understand structure
    const pageContent = await page.evaluate(() => {
      const results = document.querySelectorAll('div[data-component-type="s-search-result"]');
      const altResults = document.querySelectorAll('.s-result-item, [class*="s-result"]');
      const mainSlot = document.querySelector('div.s-main-slot');
      return {
        searchResults: results.length,
        altResults: altResults.length,
        hasMainSlot: !!mainSlot,
        pageTitle: document.title,
        url: window.location.href
      };
    });
    logger.debug('Amazon page structure', { query, ...pageContent });

    const parsed = await parseResults(page);
    logger.info('Amazon scraper completed successfully', { 
      query, 
      resultCount: parsed.length 
    });
    return parsed;
  } catch (e) {
    // Check if it's a Chrome dependency error
    const isChromeDepError = e.message && (
      e.message.includes('libnspr4') ||
      e.message.includes('libnss3') ||
      e.message.includes('shared libraries') ||
      e.message.includes('cannot open shared object')
    );
    
    if (isChromeDepError) {
      logger.error('Amazon scraper failed: Missing Chrome dependencies', { 
        query, 
        error: e.message,
        hint: 'Install Chrome dependencies: bash backend/install-chrome-deps.sh or see backend/CHROME_DEPS_FIX.md'
      });
    }
    
    // Re-throw to be handled by retry logic
    throw e;
  } finally {
    // Always close page and browser, even on error
    await safeClosePage(page, 'amazon');
    await safeCloseBrowser(browser, 'amazon');
  }
}

module.exports = { 
  search,
  name: 'amazon'
};
