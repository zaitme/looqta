/**
 * Noon.com scraper adapter (puppeteer-based)
 * High-performance scraper for Noon.com - collects ALL relevant results
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
 * - Be mindful of Noon's Terms of Service and robots.txt. Use responsibly.
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
      logger.warn('Using system Chrome as fallback (may have issues)', { path: chromePath });
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

logger.info('Noon scraper initialized', { 
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
 * Noon typically uses "Load More" buttons or infinite scroll
 */
async function tryLoadMore(page) {
  try {
    // Try multiple selectors for "Load More" buttons
    const loadMoreSelectors = [
      'button[class*="load"], button[class*="more"], button[class*="Load"], button[class*="More"]',
      'a[class*="load"], a[class*="more"], a[class*="Load"], a[class*="More"]',
      'button:contains("Load More"), button:contains("Show More"), button:contains("المزيد")',
      '[data-testid*="load"], [data-testid*="more"], [data-qa*="load"], [data-qa*="more"]',
      'button[aria-label*="more"], button[aria-label*="More"], button[aria-label*="المزيد"]',
      '[class*="load-more"], [class*="show-more"], [id*="load-more"]',
      'button.next, a.next, [class*="next"], [class*="Next"]'
    ];
    
    for (const selector of loadMoreSelectors) {
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
            if (text.includes('load more') || 
                text.includes('show more') || 
                text.includes('المزيد') ||
                text.includes('more') ||
                text.includes('next')) {
              await element.click();
              await new Promise(resolve => setTimeout(resolve, PAGINATION_WAIT_TIME));
              logger.debug('Clicked Load More button', { selector, text });
              return true;
            }
          }
        }
      } catch (e) {
        // Try next selector
        continue;
      }
    }
    
    // Try to find pagination "Next" button
    const nextButton = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      return buttons.find(btn => {
        const text = (btn.innerText || btn.textContent || '').toLowerCase();
        const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
        return (text.includes('next') || 
                text.includes('التالي') || 
                text.includes('more') ||
                ariaLabel.includes('next') ||
                ariaLabel.includes('more')) &&
               !btn.disabled &&
               window.getComputedStyle(btn).display !== 'none';
      });
    });
    
    if (nextButton) {
      await page.evaluate(btn => btn.click(), nextButton);
      await new Promise(resolve => setTimeout(resolve, PAGINATION_WAIT_TIME));
      logger.debug('Clicked Next button');
      return true;
    }
    
    return false;
  } catch (e) {
    logger.debug('Could not find Load More button', { error: e.message });
    return false;
  }
}

/**
 * Load all products by scrolling and clicking pagination buttons
 */
async function loadAllProducts(page, query) {
  let scrollAttempts = 0;
  let loadMoreClicked = false;
  let lastProductCount = 0;
  let stableCount = 0;
  let pageNumber = 1;
  
  logger.debug('Starting to load all products', { query });
  
  while (scrollAttempts < MAX_SCROLL_ATTEMPTS) {
    // Count current products
    const currentProductCount = await page.evaluate(() => {
      return document.querySelectorAll('a[href*="/p/"], a[href*="/product/"], a[href*="/saudi-en/p/"], a[href*="/sa-en/p/"], a[href*="/uae-en/p/"]').length;
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
        logger.debug('Product count stable, trying Load More button', { 
          query,
          productCount: currentProductCount,
          pageNumber
        });
        
        // Try clicking Load More button
        const clicked = await tryLoadMore(page);
        if (clicked) {
          loadMoreClicked = true;
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
    
    if (!newContentLoaded && !loadMoreClicked) {
      // No new content from scrolling, try Load More button
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
      loadMoreClicked = false; // Reset flag
      pageNumber++;
    } else {
      loadMoreClicked = false; // Reset flag
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
    return document.querySelectorAll('a[href*="/p/"], a[href*="/product/"], a[href*="/saudi-en/p/"], a[href*="/sa-en/p/"], a[href*="/uae-en/p/"]').length;
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
      const productLinks = Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/product/"], a[href*="/saudi-en/p/"], a[href*="/sa-en/p/"], a[href*="/uae-en/p/"]'));
      const productCards = new Map(); // Use Map for efficient deduplication by URL
      const seenUrls = new Set();
      
      productLinks.forEach(link => {
        const href = link.href;
        if (!href || seenUrls.has(href)) return; // Skip duplicates
        
        // Filter out non-product URLs
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
        
        // Find the parent container that likely contains the product card
        let container = link.closest('div[class*="product"], div[class*="Product"], article, div[class*="card"], div[class*="Card"], [data-cy="product-tile"], [class*="sc-"], div[class*="item"], li[class*="product"]');
        if (!container) {
          // Walk up the DOM tree to find a suitable container
          let parent = link.parentElement;
          let depth = 0;
          while (parent && depth < 12) {
            if (parent.tagName === 'DIV' || parent.tagName === 'ARTICLE' || parent.tagName === 'LI') {
              const text = parent.innerText || '';
              // Check if this looks like a product card
              const hasPrice = /\d+[\d,]*\.?\d*\s*(SAR|AED|USD|ريال|ر\.س)/i.test(text);
              const hasProductName = text.length > 10 && text.length < 3000;
              const hasProductLink = parent.querySelector('a[href*="/p/"]');
              
              if (hasProductName && hasProductLink && (hasPrice || text.length > 30)) {
                container = parent;
                break;
              }
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
          // Find product name - try multiple selectors with priority
          let titleEl = item.querySelector('h3, h2, h1, [data-qa="product-name"], .productName, .name, [class*="productName"], [class*="title"], [class*="Title"], [class*="name"]');
          if (!titleEl) {
            titleEl = item.querySelector('a[href*="/p/"], a[href*="/product/"]');
          }
          
          // Find product URL
          let urlEl = item.querySelector('a[href*="/p/"], a[href*="/product/"], a[href*="/saudi-en/p/"], a[href*="/sa-en/p/"], a[href*="/uae-en/p/"], a');
          if (!urlEl && titleEl && titleEl.tagName === 'A') {
            urlEl = titleEl;
          }
          
          // Find price - try multiple selectors with priority
          let priceEl = item.querySelector('.price, .productPrice, [data-qa="product-price"], .currency--large, [class*="price"], [class*="Price"], [class*="amount"], [class*="Amount"]');
          
          // Find currency
          let currencyEl = item.querySelector('.currency, .currencySymbol, [data-qa="currency"], [class*="currency"]');
          
          // Find image - try multiple sources, skip placeholders
          let imageEl = item.querySelector('img[src*="nooncdn.com/products"], img[src*="nooncdn.com/images"], img[data-src*="nooncdn"], img[src*="f.nooncdn.com"]');
          if (!imageEl) {
            imageEl = item.querySelector('img[data-lazy-src*="nooncdn"], img[loading="lazy"], img[data-src]');
          }
          if (!imageEl) {
            imageEl = item.querySelector('img');
          }
          
          let imageUrl = null;
          if (imageEl) {
            // Try multiple attributes for image URL
            imageUrl = imageEl.getAttribute('data-src') || 
                     imageEl.getAttribute('data-lazy-src') || 
                     imageEl.getAttribute('data-original') ||
                     imageEl.getAttribute('srcset')?.split(',')[0]?.trim().split(' ')[0] ||
                     imageEl.src;
            
            // Skip placeholder images and small thumbnails
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
            
            // Ensure we have a full URL
            if (imageUrl && !imageUrl.startsWith('http')) {
              if (imageUrl.startsWith('//')) {
                imageUrl = 'https:' + imageUrl;
              } else if (imageUrl.startsWith('/')) {
                imageUrl = 'https://www.noon.com' + imageUrl;
              } else {
                imageUrl = 'https://' + imageUrl;
              }
            }
          }
          
          // If no image found, try to extract from URL
          if (!imageUrl && urlEl && urlEl.href) {
            let urlMatch = urlEl.href.match(/\/p\/([^\/\?]+)/);
            if (!urlMatch) urlMatch = urlEl.href.match(/\/saudi-en\/p\/([^\/\?]+)/);
            if (!urlMatch) urlMatch = urlEl.href.match(/\/sa-en\/p\/([^\/\?]+)/);
            if (!urlMatch) urlMatch = urlEl.href.match(/N(\d+)/);
            
            if (urlMatch) {
              const productId = urlMatch[1];
              // Try multiple image URL formats
              imageUrl = `https://f.nooncdn.com/products/${productId}/image`;
            }
          }
          
          // Extract price text - Noon often has price in format like "99.00" or "99 SAR"
          let priceText = null;
          if (priceEl) {
            priceText = priceEl.innerText || priceEl.textContent || priceEl.getAttribute('data-price') || '';
          } else {
            // Try to find price in the entire card text - look for multiple patterns
            const cardText = item.innerText || item.textContent || '';
            // Try different price patterns
            let priceMatch = cardText.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(SAR|AED|USD|ريال|ر\.س)/i);
            if (!priceMatch) {
              priceMatch = cardText.match(/(SAR|AED|USD|ريال|ر\.س)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i);
              if (priceMatch) {
                priceText = priceMatch[2] + ' ' + priceMatch[1];
              }
            } else {
              priceText = priceMatch[1] + ' ' + priceMatch[2];
            }
            // If still no match, try to find just numbers that look like prices
            if (!priceText) {
              const numbers = cardText.match(/\d{2,6}(?:,\d{3})*(?:\.\d{2})?/g);
              if (numbers && numbers.length > 0) {
                // Take the largest number that's likely a price (between 10 and 999999)
                const prices = numbers.map(n => parseFloat(n.replace(/,/g, ''))).filter(p => p >= 10 && p <= 999999);
                if (prices.length > 0) {
                  priceText = prices[0].toString();
                }
              }
            }
          }
          
          const productName = titleEl ? (titleEl.innerText || titleEl.textContent || '').trim() : null;
          const productUrl = urlEl ? (urlEl.href || null) : null;
          
          if (productName && productName.length > 3 && productUrl) {
            return {
              product_name: productName,
              url: productUrl,
              price_text: priceText ? priceText.trim() : null,
              currency: currencyEl ? (currencyEl.innerText || currencyEl.textContent || '').trim() : null,
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
        results = await page.$$eval('div[data-qa="product-name"], div.productContainer, article[data-testid="product-card"], div[class*="ProductContainer"], [data-cy="product-tile"]', items => {
          return {
            items: items.map(item => {
              const titleEl = item.querySelector('h3, h2, [data-qa="product-name"], .productName, .name, [class*="productName"]');
              const urlEl = item.querySelector('a[href*="/p/"], a[href*="/product/"], a[href*="/saudi-en/p/"], a[href*="/sa-en/p/"], a[href*="/uae-en/p/"], a');
              const priceEl = item.querySelector('.price, .productPrice, [data-qa="product-price"], .currency--large, [class*="price"], [class*="Price"]');
              const currencyEl = item.querySelector('.currency, .currencySymbol, [data-qa="currency"], [class*="currency"]');
              let imageEl = item.querySelector('img[src*="nooncdn.com/products"], img[src*="nooncdn.com/images"], img[data-src*="nooncdn"]');
              if (!imageEl) imageEl = item.querySelector('img');
              
              let imageUrl = null;
              if (imageEl) {
                imageUrl = imageEl.getAttribute('data-src') || imageEl.src;
                if (imageUrl && (imageUrl.includes('placeholder') || imageUrl.includes('media-placeholder'))) {
                  imageUrl = null;
                }
              }
              
              if (!imageUrl && urlEl && urlEl.href) {
                let urlMatch = urlEl.href.match(/\/p\/([^\/\?]+)/);
                if (!urlMatch) urlMatch = urlEl.href.match(/\/saudi-en\/p\/([^\/\?]+)/);
                if (!urlMatch) urlMatch = urlEl.href.match(/\/sa-en\/p\/([^\/\?]+)/);
                if (!urlMatch) urlMatch = urlEl.href.match(/N(\d+)/);
                
                if (urlMatch) {
                  const productId = urlMatch[1];
                  imageUrl = `https://f.nooncdn.com/products/${productId}/image`;
                }
              }
              
              return {
                product_name: titleEl ? (titleEl.innerText || titleEl.textContent || '').trim() : null,
                url: urlEl ? (urlEl.href || null) : null,
                price_text: priceEl ? (priceEl.innerText || priceEl.textContent || '').trim() : null,
                currency: currencyEl ? (currencyEl.innerText || currencyEl.textContent || '').trim() : null,
                image: imageUrl
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
    logger.debug('Primary Noon selector failed, trying fallback', { error: e.message });
    // Last resort fallback
    try {
      results = await page.$$eval('div.sc-1, div[class*="product"], article, div[class*="Product"], li[class*="product"]', items => {
        return {
          items: items.map(item => {
            const titleEl = item.querySelector('h1, h2, h3, h4, [class*="title"], [class*="name"], [class*="Title"], [class*="Name"]');
            const urlEl = item.querySelector('a');
            const priceEl = item.querySelector('[class*="price"], [class*="amount"], [class*="Price"], [class*="Amount"]');
            
            return {
              product_name: titleEl ? (titleEl.innerText || titleEl.textContent || '').trim() : null,
              url: urlEl ? urlEl.href : null,
              price_text: priceEl ? (priceEl.innerText || priceEl.textContent || '').trim() : null,
              currency: null,
              image: null
            };
          }).filter(item => item.product_name && item.url && item.product_name.length > 3),
          totalFound: items.length
        };
      });
    } catch (e2) {
      logger.warn('All Noon selectors failed', { error: e2.message });
      return { items: [], totalFound: 0 };
    }
  }
  
  logger.debug('Noon scraper found items', { 
    totalFound: results.totalFound, 
    parsed: results.items.length 
  });
  
  const parsedItems = results.items;

  // Normalize and process results
  const normalized = parsedItems
    .filter(r => {
      // Require product name and URL
      if (!r.product_name || r.product_name.length < 3) return false;
      if (!r.url || !r.url.includes('/p/')) return false;
      return true;
    })
    .map(r => {
      // Extract numeric price - handle formats like "99.00", "99 SAR", "SAR 99", "1,899", etc.
      let priceText = r.price_text || '';
      
      // Extract all numbers with commas (prices like "2,399" or "1,899")
      const priceMatches = priceText.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g);
      
      let price = null;
      if (priceMatches && priceMatches.length > 0) {
        // Take the first match (usually the current/sale price)
        const cleanPrice = priceMatches[0].replace(/,/g, '');
        price = parseFloat(cleanPrice);
        
        // Validate price range
        if (price && (price < 1 || price > 1000000)) {
          price = null;
        }
      } else {
        // Fallback: try to extract any number
        const numbers = priceText.match(/\d+/g);
        if (numbers && numbers.length > 0) {
          const sortedNumbers = numbers.sort((a, b) => b.length - a.length);
          const parsedPrice = parseFloat(sortedNumbers[0]);
          if (parsedPrice >= 1 && parsedPrice <= 1000000) {
            price = parsedPrice;
          }
        }
      }
      
      // Determine currency - Noon typically uses SAR or AED
      let currency = r.currency;
      if (!currency || currency.trim().length === 0 || currency.charCodeAt(0) > 127) {
        // Try to extract from price_text - look for currency codes
        const currencyMatch = priceText.match(/(SAR|AED|USD|EUR|GBP|ريال)/i);
        if (currencyMatch) {
          currency = currencyMatch[1].toUpperCase();
          // Handle Arabic "ريال" (Riyal)
          if (currency.includes('ريال') || currency.toLowerCase().includes('riyal')) {
            currency = 'SAR';
          }
        } else {
          // Default based on URL - uae-en suggests AED, saudi-en/sa-en suggests SAR
          currency = r.url && r.url.includes('/uae-en/') ? 'AED' : 'SAR';
        }
      } else {
        currency = currency.trim().toUpperCase();
        // Clean up weird characters
        if (currency.charCodeAt(0) > 127 || currency.length > 5) {
          currency = r.url && r.url.includes('/uae-en/') ? 'AED' : 'SAR';
        }
      }
      
      // Extract image from URL if not found
      let imageUrl = r.image;
      if (!imageUrl || imageUrl.includes('placeholder')) {
        if (r.url) {
          // Try multiple URL patterns for Noon
          let urlMatch = r.url.match(/\/p\/([^\/\?]+)/);
          if (!urlMatch) urlMatch = r.url.match(/\/saudi-en\/p\/([^\/\?]+)/);
          if (!urlMatch) urlMatch = r.url.match(/\/sa-en\/p\/([^\/\?]+)/);
          if (!urlMatch) urlMatch = r.url.match(/N(\d+)/);
          
          if (urlMatch) {
            const productId = urlMatch[1];
            imageUrl = `https://f.nooncdn.com/products/${productId}/image`;
          }
        }
      }
      
      // Normalize URL - remove query params
      let productUrl = r.url;
      try {
        const urlObj = new URL(productUrl);
        productUrl = `${urlObj.origin}${urlObj.pathname}`;
      } catch (e) {
        // Invalid URL, keep as is
      }
      
      return {
        product_name: r.product_name.trim(),
        site: 'noon.com',
        price: price,
        currency: currency,
        url: productUrl,
        image: imageUrl,
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
  const validated = validateResults(uniqueProducts, 'noon');
  
  logger.debug('Noon validation', { 
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
  const encodedQuery = encodeURIComponent(query.trim());
  const searchUrl = `https://www.noon.com/saudi-en/search/?q=${encodedQuery}`;
  
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
    logger.error('Noon scraper failed', { 
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
    logger.debug('Starting Noon scraper', { 
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
    
    logger.debug('Navigating to Noon search page', { query });
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
        logger.warn('Noon scraper: Navigation failed, skipping scraper', { 
          query, 
          url: searchUrl,
          error: navError.message 
        });
        return [];
      }
      throw navError;
    }
    
    // Wait for results - Noon may use different containers
    try {
      await page.waitForSelector('div[data-qa="product-name"], div.productContainer, article[data-testid="product-card"], div[class*="ProductContainer"], [data-cy="product-tile"], a[href*="/p/"]', { timeout: 20000 });
    } catch (e) {
      try {
        await page.waitForSelector('div.sc-1, div[class*="product"], article, div[class*="Product"], [class*="sc-"], a[href*="/saudi-en/p/"]', { timeout: 15000 });
      } catch (e2) {
        logger.warn('Noon: Could not find expected product containers, proceeding anyway', { query });
      }
    }
    
    // Wait for initial dynamic content to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Load ALL products by scrolling and clicking pagination
    await loadAllProducts(page, query);
    
    // Parse all results
    const results = await parseResults(page);
    
    logger.info('Noon scraper completed successfully', { 
      query, 
      resultCount: results.length 
    });
    
    return results;
  } catch (e) {
    // Check for Chrome dependency errors
    const isChromeDepError = e.message && (
      e.message.includes('libnspr4') ||
      e.message.includes('libnss3') ||
      e.message.includes('shared libraries') ||
      e.message.includes('cannot open shared object')
    );
    
    if (isChromeDepError) {
      logger.error('Noon scraper failed: Missing Chrome dependencies', { 
        query, 
        error: e.message,
        hint: 'Install Chrome dependencies: bash backend/install-chrome-deps.sh or see backend/CHROME_DEPS_FIX.md'
      });
    }
    
    // Check for DNS resolution errors
    if (e.message && (
      e.message.includes('ERR_NAME_NOT_RESOLVED') ||
      e.message.includes('net::ERR_NAME_NOT_RESOLVED') ||
      e.message.includes('DNS_PROBE_FINISHED_NXDOMAIN')
    )) {
      logger.warn('Noon scraper: Domain resolution failed, skipping scraper', { 
        query, 
        url: searchUrl,
        error: e.message 
      });
      return [];
    }
    
    throw e;
  } finally {
    // Always close page and browser, even on error
    await safeClosePage(page, 'noon');
    await safeCloseBrowser(browser, 'noon');
  }
}

module.exports = { 
  search,
  name: 'noon',
  site: 'noon.com'
};
