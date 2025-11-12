/**
 * Jarir Bookstore scraper (jarir.com)
 * High-performance scraper for Jarir.com - collects ALL relevant results
 * 
 * Features:
 * - Comprehensive pagination handling
 * - Infinite scroll detection
 * - Efficient product detection with no artificial limits
 * - Advanced error handling and retry logic
 * - Performance optimizations
 * - Comprehensive logging
 * - Proper deduplication
 * - Robust price and image extraction
 * 
 * Notes:
 * - Uses headless Puppeteer. In Docker, puppeteer is launched with --no-sandbox --disable-setuid-sandbox.
 * - Be mindful of Jarir's Terms of Service and robots.txt. Use responsibly.
 */

const puppeteer = require('puppeteer');
const logger = require('../utils/logger');
const { setupChromeEnvironment, getChromeLaunchOptions } = require('../utils/chrome-deps-fix');
const { validateResults } = require('../utils/result-validator');
const { safeCloseBrowser, safeClosePage, retryWithBackoff, classifyError } = require('../utils/scraper-helpers');

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MAX_RESULTS = 1000; // High limit to capture all relevant results
const SCROLL_PAUSE_TIME = 2000; // Time to wait after scrolling
const MAX_SCROLL_ATTEMPTS = 25; // Maximum scroll attempts before giving up
const PAGINATION_WAIT_TIME = 3000; // Time to wait after clicking pagination

// Chrome executable path detection
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

// Setup Chrome environment
setupChromeEnvironment();
const CHROME_EXECUTABLE = getChromeExecutablePath();
const LAUNCH_OPTIONS = getChromeLaunchOptions({
  executablePath: CHROME_EXECUTABLE
});

logger.info('Jarir scraper initialized', { 
  chromeExecutable: CHROME_EXECUTABLE,
  headless: LAUNCH_OPTIONS.headless 
});

/**
 * Scroll page to load lazy-loaded content
 * Returns true if new content was loaded, false otherwise
 */
async function scrollToLoadMore(page) {
  const previousHeight = await page.evaluate(() => document.body.scrollHeight);
  
  // Smooth scroll to bottom
  await page.evaluate(() => {
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: 'smooth'
    });
  });
  
  // Wait for content to load
  await new Promise(resolve => setTimeout(resolve, SCROLL_PAUSE_TIME));
  
  const newHeight = await page.evaluate(() => document.body.scrollHeight);
  return newHeight > previousHeight;
}

/**
 * Try to click "Load More" or pagination buttons
 * Jarir typically uses pagination links like "Next" or numbered pages
 */
async function tryLoadMore(page) {
  try {
    // Try multiple selectors for pagination buttons
    const paginationSelectors = [
      'a[class*="next"], a[class*="Next"], button[class*="next"], button[class*="Next"]',
      'a[title*="Next"], a[title*="التالي"], button[title*="Next"]',
      'a[aria-label*="next"], a[aria-label*="Next"], button[aria-label*="next"]',
      '.pages a:last-child, .pagination a:last-child, [class*="pagination"] a:last-child',
      'a:contains("Next"), a:contains("التالي"), button:contains("Next")',
      '[data-testid*="next"], [data-qa*="next"], [data-testid*="pagination"]',
      '.toolbar-products .pages a, .pages .next, .pager .next'
    ];
    
    for (const selector of paginationSelectors) {
      try {
        const elements = await page.$$(selector);
        for (const element of elements) {
          const isVisible = await page.evaluate(el => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return rect.top >= 0 && 
                   rect.bottom <= window.innerHeight && 
                   style.display !== 'none' &&
                   style.visibility !== 'hidden' &&
                   style.opacity !== '0' &&
                   !el.disabled;
          }, element);
          
          if (isVisible) {
            const text = await page.evaluate(el => (el.innerText || el.textContent || '').toLowerCase(), element);
            if (text.includes('next') || text.includes('التالي') || text.includes('>')) {
              await element.click();
              await new Promise(resolve => setTimeout(resolve, PAGINATION_WAIT_TIME));
              logger.debug('Clicked pagination Next button', { selector, text });
              return true;
            }
          }
        }
      } catch (e) {
        // Try next selector
        continue;
      }
    }
    
    // Try to find numbered pagination links (click the next page number)
    const pageNumbers = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('.pages a, .pagination a, [class*="pagination"] a, [class*="page"] a'));
      return links
        .map(link => ({
          element: link,
          text: (link.innerText || link.textContent || '').trim(),
          href: link.href,
          isCurrent: link.classList.contains('current') || link.classList.contains('active')
        }))
        .filter(link => {
          const num = parseInt(link.text);
          return !isNaN(num) && num > 0;
        })
        .sort((a, b) => parseInt(a.text) - parseInt(b.text));
    });
    
    if (pageNumbers.length > 0) {
      // Find current page and click next
      const currentIndex = pageNumbers.findIndex(p => p.isCurrent);
      if (currentIndex >= 0 && currentIndex < pageNumbers.length - 1) {
        const nextPage = pageNumbers[currentIndex + 1];
        await page.evaluate(el => el.click(), nextPage.element);
        await new Promise(resolve => setTimeout(resolve, PAGINATION_WAIT_TIME));
        logger.debug('Clicked next page number', { pageNumber: nextPage.text });
        return true;
      }
    }
    
    return false;
  } catch (e) {
    logger.debug('Could not find pagination button', { error: e.message });
    return false;
  }
}

/**
 * Load all products by scrolling and clicking pagination buttons
 */
async function loadAllProducts(page, query) {
  let scrollAttempts = 0;
  let paginationClicked = false;
  let lastProductCount = 0;
  let stableCount = 0;
  let pageNumber = 1;
  
  logger.debug('Starting to load all products', { query });
  
  while (scrollAttempts < MAX_SCROLL_ATTEMPTS) {
    // Count current products
    const currentProductCount = await page.evaluate(() => {
      return document.querySelectorAll('a[href*="/sa-en/"], a[href*="/product/"], a[href*="/p/"], .product-item, .product-card, [class*="product-item"]').length;
    });
    
    logger.debug('Product loading progress', { 
      query,
      scrollAttempt: scrollAttempts + 1,
      pageNumber,
      currentProducts: currentProductCount,
      lastCount: lastProductCount
    });
    
    // Check if product count is stable (no new products loaded)
    if (currentProductCount === lastProductCount) {
      stableCount++;
      if (stableCount >= 3) {
        logger.debug('Product count stable, trying pagination', { 
          query,
          productCount: currentProductCount,
          pageNumber
        });
        
        // Try clicking pagination button
        const clicked = await tryLoadMore(page);
        if (clicked) {
          paginationClicked = true;
          stableCount = 0; // Reset stable count after clicking
          pageNumber++;
          await new Promise(resolve => setTimeout(resolve, PAGINATION_WAIT_TIME));
          continue;
        } else {
          // No more content to load
          logger.info('All products loaded', { 
            query,
            totalProducts: currentProductCount,
            scrollAttempts: scrollAttempts + 1,
            pages: pageNumber
          });
          break;
        }
      }
    } else {
      stableCount = 0; // Reset if count changed
    }
    
    lastProductCount = currentProductCount;
    
    // Scroll to load more
    const newContentLoaded = await scrollToLoadMore(page);
    
    if (!newContentLoaded && !paginationClicked) {
      // No new content from scrolling, try pagination
      const clicked = await tryLoadMore(page);
      if (!clicked) {
        // No more content available
        logger.info('No more content to load', { 
          query,
          totalProducts: currentProductCount,
          scrollAttempts: scrollAttempts + 1,
          pages: pageNumber
        });
        break;
      }
      paginationClicked = false; // Reset flag
      pageNumber++;
    } else {
      paginationClicked = false; // Reset flag
    }
    
    scrollAttempts++;
  }
  
  // Final scroll to top to ensure all images are loaded
  await page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Final scroll to bottom to trigger any remaining lazy loads
  await page.evaluate(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  });
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const finalProductCount = await page.evaluate(() => {
    return document.querySelectorAll('a[href*="/sa-en/"], a[href*="/product/"], a[href*="/p/"], .product-item, .product-card, [class*="product-item"]').length;
  });
  
  logger.info('Finished loading all products', { 
    query,
    totalProducts: finalProductCount,
    scrollAttempts,
    pages: pageNumber
  });
}

/**
 * Comprehensive product parsing - no limits, efficient deduplication
 */
async function parseResults(page) {
  let results;
  
  try {
    // Primary selector strategy - collect ALL products efficiently
    results = await page.evaluate(() => {
      // Find ALL product links (no limit)
      const productLinks = Array.from(document.querySelectorAll('a[href*="/sa-en/"], a[href*="/product/"], a[href*="/p/"]'));
      const productCards = new Map(); // Use Map for efficient deduplication by URL
      const seenUrls = new Set();
      
      productLinks.forEach(link => {
        const href = link.href;
        if (!href || seenUrls.has(href)) return; // Skip duplicates
        
        // Filter to only actual product links
        const hrefLower = href.toLowerCase();
        if (hrefLower.includes('/blog/') || 
            hrefLower.includes('/category/') || 
            hrefLower.includes('/brand/') || 
            hrefLower.includes('/help/') ||
            hrefLower.includes('/about/') || 
            hrefLower.includes('/contact/') ||
            hrefLower.includes('/checkout/') ||
            hrefLower.includes('/cart/')) {
          return;
        }
        
        // Must be a product URL pattern
        if (!hrefLower.includes('/sa-en/') && 
            !hrefLower.includes('/product/') && 
            !hrefLower.includes('/p/')) {
          return;
        }
        
        const linkText = (link.innerText || link.textContent || '').trim();
        // Exclude navigation/UI elements
        if (linkText.toLowerCase().includes('view all') || 
            linkText.toLowerCase().includes('see more') ||
            linkText.toLowerCase().includes('عرض الكل') ||
            linkText.toLowerCase().includes('المزيد') ||
            linkText.toLowerCase().includes('next') ||
            linkText.toLowerCase().includes('التالي')) {
          return;
        }
        
        // Find the parent container that likely contains the product card
        let container = link.closest('.product-item, .product-card, [class*="product"], .item-product, [data-product-id], .product-tile, article, [class*="Product"], li[class*="product"], div[class*="product-item"]');
        if (!container) {
          // Walk up the DOM tree to find a suitable container
          let parent = link.parentElement;
          let depth = 0;
          while (parent && depth < 12) {
            const parentClass = (parent.className || '').toLowerCase();
            const parentTag = parent.tagName.toLowerCase();
            const parentId = (parent.id || '').toLowerCase();
            
            if ((parentTag === 'div' || parentTag === 'article' || parentTag === 'li') && 
                (parentClass.includes('product') || 
                 parentClass.includes('item') || 
                 parentClass.includes('card') ||
                 parentId.includes('product'))) {
              container = parent;
              break;
            }
            parent = parent.parentElement;
            depth++;
          }
        }
        
        if (container && !productCards.has(href)) {
          productCards.set(href, container);
          seenUrls.add(href);
        }
      });
      
      const items = Array.from(productCards.values()); // Get all unique containers
      
      return {
        items: items.map(item => {
          // Find product name - try multiple selectors
          let titleEl = item.querySelector('h1, h2, h3, .product-title, .product-name, [class*="title"], [class*="name"], [class*="Title"], [class*="Name"], a[href*="/product"], a[href*="/sa-en/"]');
          if (!titleEl) {
            titleEl = item.querySelector('a[href*="/product"], a[href*="/sa-en/"]');
          }
          const productName = titleEl ? (titleEl.innerText || titleEl.textContent || titleEl.getAttribute('title') || '').trim() : null;
          
          // Find product URL - prioritize sa-en URLs
          let urlEl = item.querySelector('a[href*="/sa-en/"], a[href*="/product/"], a[href*="/p/"], .product-link, h1 a, h2 a, h3 a');
          if (!urlEl) {
            urlEl = item.querySelector('a[href*="jarir.com"]');
          }
          if (!urlEl && titleEl && titleEl.tagName === 'A') {
            urlEl = titleEl;
          }
          
          let productUrl = null;
          if (urlEl && urlEl.href) {
            productUrl = urlEl.href;
            // Ensure URL uses sa-en if it's a jarir.com URL
            if (productUrl.includes('jarir.com') && !productUrl.includes('/sa-en/')) {
              productUrl = productUrl.replace(/jarir\.com\/([^\/]+)/, 'jarir.com/sa-en/$1');
            }
            // Clean URL - remove query params and hash
            try {
              const urlObj = new URL(productUrl);
              productUrl = `${urlObj.origin}${urlObj.pathname}`;
            } catch (e) {
              // Invalid URL, keep as is
            }
          }
          
          // Find price - try multiple selectors with priority
          let priceEl = item.querySelector('.price, .product-price, [class*="price"], .amount, [class*="Price"], [class*="Amount"], [data-price], [class*="amount"], .special-price, .regular-price');
          if (!priceEl) {
            // Try to find price in text content
            const cardText = item.innerText || item.textContent || '';
            const priceMatch = cardText.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(SAR|ريال|ر\.س|ر\.س\.)/i);
            if (priceMatch) {
              priceEl = { innerText: priceMatch[1] + ' ' + priceMatch[2] };
            }
          }
          
          let priceText = null;
          if (priceEl) {
            priceText = priceEl.innerText || priceEl.textContent || priceEl.getAttribute('data-price') || '';
            // Clean up price text
            priceText = priceText.replace(/\s+/g, ' ').trim();
          }
          
          // Find image - try multiple sources with priority
          let imageEl = item.querySelector('img[src*="jarir"], img.product-image, img[class*="product"], img[data-src*="jarir"], img[data-lazy-src*="jarir"], img[srcset*="jarir"]');
          if (!imageEl) {
            imageEl = item.querySelector('img');
          }
          
          let imageUrl = null;
          if (imageEl) {
            imageUrl = imageEl.getAttribute('data-src') || 
                      imageEl.getAttribute('data-lazy-src') || 
                      imageEl.getAttribute('data-original') ||
                      imageEl.getAttribute('srcset')?.split(',')[0]?.trim().split(' ')[0] ||
                      imageEl.src;
            
            // Skip placeholder images
            if (imageUrl && (
              imageUrl.includes('placeholder') || 
              imageUrl.includes('media-placeholder') ||
              imageUrl.includes('thumb') ||
              imageUrl.includes('icon') ||
              imageUrl.includes('logo') ||
              imageUrl.includes('spinner')
            )) {
              imageUrl = null;
            }
            
            // Ensure full URL
            if (imageUrl && !imageUrl.startsWith('http')) {
              if (imageUrl.startsWith('//')) {
                imageUrl = 'https:' + imageUrl;
              } else if (imageUrl.startsWith('/')) {
                imageUrl = 'https://www.jarir.com' + imageUrl;
              } else {
                imageUrl = 'https://' + imageUrl;
              }
            }
          }
          
          if (productName && productName.length > 3 && productUrl) {
            return {
              product_name: productName,
              url: productUrl,
              price_text: priceText,
              image: imageUrl
            };
          }
          return null;
        }).filter(item => item !== null), // Filter out null items
        totalFound: items.length
      };
    });
    
    // Fallback selector strategy if primary returns no results
    if (!results || !results.items || results.items.length === 0) {
      try {
        results = await page.$$eval('.product-item, .product-card, [class*="product-item"], [class*="product-card"]', items => {
          return {
            items: items.map(item => {
              const titleEl = item.querySelector('h1, h2, h3, [class*="title"], [class*="name"]');
              const urlEl = item.querySelector('a[href*="/sa-en/"], a[href*="/product/"]');
              const priceEl = item.querySelector('[class*="price"], [class*="amount"]');
              const imageEl = item.querySelector('img');
              
              return {
                product_name: titleEl ? (titleEl.innerText || titleEl.textContent || '').trim() : null,
                url: urlEl ? urlEl.href : null,
                price_text: priceEl ? (priceEl.innerText || priceEl.textContent || '').trim() : null,
                image: imageEl ? (imageEl.src || imageEl.getAttribute('data-src')) : null
              };
            }).filter(item => item.product_name && item.url),
            totalFound: items.length
          };
        });
      } catch (fallbackError) {
        logger.debug('Fallback selector also failed', { error: fallbackError.message });
      }
    }
  } catch (e) {
    logger.debug('Primary Jarir selector failed, trying fallback', { error: e.message });
    // Last resort fallback
    try {
      results = await page.$$eval('article, li[class*="item"], div[class*="item"]', items => {
        return {
          items: items.map(item => {
            const titleEl = item.querySelector('h1, h2, h3, h4, a');
            const urlEl = item.querySelector('a[href*="jarir.com"]');
            const priceEl = item.querySelector('[class*="price"], [class*="amount"]');
            
            return {
              product_name: titleEl ? (titleEl.innerText || titleEl.textContent || '').trim() : null,
              url: urlEl ? urlEl.href : null,
              price_text: priceEl ? (priceEl.innerText || priceEl.textContent || '').trim() : null,
              image: null
            };
          }).filter(item => item.product_name && item.url && item.product_name.length > 3),
          totalFound: items.length
        };
      });
    } catch (e2) {
      logger.warn('All Jarir selectors failed', { error: e2.message });
      return { items: [], totalFound: 0 };
    }
  }
  
  logger.debug('Jarir scraper found items', { 
    totalFound: results.totalFound, 
    parsed: results.items.length 
  });
  
  const parsedItems = results.items;

  // Normalize and process results
  const normalized = parsedItems
    .filter(r => {
      // Require product name and URL
      if (!r.product_name || r.product_name.length < 3) return false;
      if (!r.url || (!r.url.includes('/sa-en/') && !r.url.includes('/product/'))) return false;
      return true;
    })
    .map(r => {
      // Extract numeric price - handle multiple formats
      let price = null;
      if (r.price_text) {
        // Remove all non-numeric characters except commas and dots
        const clean = r.price_text.replace(/[^0-9.,]/g, '').replace(/,/g, '');
        price = parseFloat(clean) || null;
        
        // Validate price range (reasonable for Jarir products)
        if (price && (price < 1 || price > 1000000)) {
          price = null;
        }
      }
      
      // Normalize URL - ensure sa-en prefix
      let productUrl = r.url;
      if (productUrl && productUrl.includes('jarir.com') && !productUrl.includes('/sa-en/')) {
        productUrl = productUrl.replace(/jarir\.com\/([^\/]+)/, 'jarir.com/sa-en/$1');
      }
      
      // Clean URL
      try {
        const urlObj = new URL(productUrl);
        productUrl = `${urlObj.origin}${urlObj.pathname}`;
      } catch (e) {
        // Invalid URL, keep as is
      }
      
      return {
        product_name: r.product_name.trim(),
        site: 'jarir.com',
        price: price,
        currency: 'SAR',
        url: productUrl,
        image: r.image || null,
        raw: r
      };
    });
  
  // Remove duplicates based on URL (most reliable)
  const uniqueProducts = [];
  const seenUrls = new Set();
  for (const product of normalized) {
    if (product.url && !seenUrls.has(product.url)) {
      seenUrls.add(product.url);
      uniqueProducts.push(product);
    }
  }
  
  // Validate results to filter out invalid items
  const validated = validateResults(uniqueProducts, 'jarir');
  
  logger.debug('Jarir validation', { 
    beforeValidation: uniqueProducts.length,
    afterValidation: validated.length,
    filtered: uniqueProducts.length - validated.length
  });
  
  // Return all validated results (up to MAX_RESULTS if set)
  return validated.slice(0, MAX_RESULTS);
}

/**
 * Main search function with retry logic
 */
async function search(query) {
  const searchUrl = `https://www.jarir.com/sa-en/catalogsearch/result/?q=${encodeURIComponent(query.trim())}`;
  
  try {
    return await retryWithBackoff(async () => {
      return await performSearch(query, searchUrl);
    }, {
      maxRetries: 2,
      initialDelay: 1000,
      retryableErrors: ['timeout', 'ECONNRESET', 'ETIMEDOUT', 'protocol timeout']
    });
  } catch (error) {
    const errorInfo = classifyError(error);
    logger.error('Jarir scraper failed', { 
      query, 
      error: error.message,
      errorType: errorInfo.type,
      retryable: errorInfo.retryable,
      stack: error.stack 
    });
    return [];
  }
}

/**
 * Perform the actual search with browser automation
 */
async function performSearch(query, searchUrl) {
  let browser, page;
  try {
    logger.debug('Starting Jarir scraper', { 
      query, 
      url: searchUrl,
      executablePath: LAUNCH_OPTIONS.executablePath,
      args: LAUNCH_OPTIONS.args?.length || 0
    });
    
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
    
    logger.debug('Navigating to Jarir search page', { query });
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
        logger.warn('Jarir scraper: Navigation failed, skipping scraper', { 
          query, 
          url: searchUrl,
          error: navError.message 
        });
        return [];
      }
      throw navError;
    }
    
    // Wait for results - try multiple selectors
    try {
      await page.waitForSelector('.product-item, .product-card, [class*="product"], [data-product-id], a[href*="/sa-en/"]', { timeout: 20000 });
    } catch (e) {
      try {
        await page.waitForSelector('div[class*="Product"], article, [class*="item"], [class*="product-item"]', { timeout: 15000 });
      } catch (e2) {
        logger.warn('Jarir: Could not find expected product containers, proceeding anyway', { query });
      }
    }
    
    // Wait for initial dynamic content to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Load ALL products by scrolling and clicking pagination
    await loadAllProducts(page, query);
    
    // Parse all results
    const results = await parseResults(page);
    
    logger.info('Jarir scraper completed successfully', { 
      query, 
      resultCount: results.length 
    });
    
    return results;
    
  } catch (error) {
    // Check for DNS resolution errors - don't retry these
    if (error.message && (
      error.message.includes('ERR_NAME_NOT_RESOLVED') ||
      error.message.includes('net::ERR_NAME_NOT_RESOLVED') ||
      error.message.includes('DNS_PROBE_FINISHED_NXDOMAIN')
    )) {
      logger.warn('Jarir scraper: Domain resolution failed, skipping scraper', { 
        query, 
        url: searchUrl,
        error: error.message 
      });
      return [];
    }
    
    // Check for Chrome dependency errors
    const isChromeDepError = error.message && (
      error.message.includes('libnspr4') ||
      error.message.includes('libnss3') ||
      error.message.includes('shared libraries') ||
      error.message.includes('cannot open shared object')
    );
    
    if (isChromeDepError) {
      logger.error('Jarir scraper failed: Missing Chrome dependencies', { 
        query, 
        error: error.message,
        hint: 'Install Chrome dependencies: bash backend/install-chrome-deps.sh or see backend/CHROME_DEPS_FIX.md'
      });
    }
    
    throw error;
  } finally {
    // Always close page and browser, even on error
    await safeClosePage(page, 'jarir');
    await safeCloseBrowser(browser, 'jarir');
  }
}

module.exports = {
  name: 'jarir',
  search
};
