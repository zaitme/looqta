/**
 * Noon.com scraper adapter (puppeteer-based, API-First, optimized)
 * PERFORMANCE-ENHANCED VERSION – SAME INPUT/OUTPUT CONTRACT
 */

const puppeteer = require('puppeteer');
const logger = require('../utils/logger');
const { setupChromeEnvironment, getChromeLaunchOptions } = require('../utils/chrome-deps-fix');
const { validateResults } = require('../utils/result-validator');
const { safeCloseBrowser, safeClosePage, retryWithBackoff, classifyError } = require('../utils/scraper-helpers');

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const MAX_RESULTS = 1000;
const API_TIMEOUT = 25000;

const PRODUCT_FEED_URL_PATTERN = '/api/v1/search/product-feed';

// ---- Chrome Setup -----------------------------------------------------------
setupChromeEnvironment();

function getChromeExecutablePath() {
  const fs = require('fs');
  const puppeteer = require('puppeteer');

  const bundled = puppeteer.executablePath();
  if (fs.existsSync(bundled)) return bundled;

  const candidates = [
    '/opt/google/chrome/chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ];

  for (const c of candidates) if (fs.existsSync(c)) return c;
  logger.error('Chrome not found');
  return undefined;
}

const CHROME_EXECUTABLE = getChromeExecutablePath();
const LAUNCH_OPTIONS = getChromeLaunchOptions({ executablePath: CHROME_EXECUTABLE });

logger.info('Noon scraper initialized', {
  chromeExecutable: CHROME_EXECUTABLE,
  headless: LAUNCH_OPTIONS.headless
});

// ---- Utility: Block heavy resources ----------------------------------------
function shouldBlock(resourceType, url) {
  if (['image', 'font', 'media', 'stylesheet'].includes(resourceType)) return true;
  if (url.includes('.woff') || url.includes('.ttf') || url.includes('.png')) return true;
  return false;
}

// ---- API Interception -------------------------------------------------------
async function interceptAndFetchJson(page, searchUrl) {
  let resolved = false;

  await page.setRequestInterception(true);

  // Pre-bind cleanup function
  const cleanup = () => {
    page.removeAllListeners('request');
    page.removeAllListeners('response');
  };

  const apiPromise = new Promise((resolve) => {
    const onResponse = async (response) => {
      try {
        const url = response.url();

        if (!url.includes(PRODUCT_FEED_URL_PATTERN)) return;

        if (resolved) return;

        const status = response.status();
        if (status < 200 || status >= 300) {
          resolve(null);
          resolved = true;
          return;
        }

        const json = await response.json().catch(() => null);
        resolved = true;
        resolve(json);
      } catch {
        resolve(null);
      }
    };

    page.on('response', onResponse);
  });

  page.on('request', (req) => {
    try {
      if (shouldBlock(req.resourceType(), req.url())) return req.abort();
      req.continue();
    } catch (e) {}
  });

  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});

  const result = await Promise.race([
    apiPromise,
    new Promise((r) => setTimeout(() => r(null), API_TIMEOUT))
  ]);

  cleanup();
  return result || null;
}

// ---- Parsing ---------------------------------------------------------------
async function parseResults(page, apiJson = null) {
  let raw = [];
  let source = 'DOM';

  // ---- Primary: API --------------------------------------------------------
  if (apiJson && apiJson.productFeeds?.length) {
    source = 'API';
    const feed = apiJson.productFeeds[0];
    const products = feed.products || feed.items || [];

    raw = products
      .map((p) => ({
        product_name: p.title || p.productName || null,
        site: 'noon.com',
        price: Number(p.price || p.currentPrice || 0),
        currency: (p.currency || 'SAR').toUpperCase(),
        url: p.url || (p.sku ? `https://www.noon.com/p/${p.sku}` : null),
        image: p.image || p.imageUrl || null,
        raw: p
      }))
      .filter((x) => x.product_name && x.price > 0);
  }

  // ---- Fallback: DOM -------------------------------------------------------
  else {
    try {
      await page.waitForSelector('a[href*="/p/"]', { timeout: 8000 });
    } catch {
      return [];
    }

    raw = await page.evaluate(() => {
      const links = Array.from(
        document.querySelectorAll(
          'a[href*="/p/"], a[href*="/product/"], a[href*="/sa-en/p/"], a[href*="/uae-en/p/"]'
        )
      );

      const seen = new Set();
      const items = [];

      for (const link of links) {
        const href = link.href;
        if (!href || seen.has(href)) continue;
        seen.add(href);

        const container =
          link.closest('[data-cy="product-tile"], article, div[class*="product"], div[class*="Card"]') ||
          link.parentElement;

        if (!container) continue;

        const titleEl = container.querySelector('h3, h2, [data-qa="product-name"]');
        const priceEl =
          container.querySelector('.price, [data-qa="product-price"], [class*="amount"]');

        const title = titleEl?.innerText?.trim();
        const priceMatch = priceEl?.innerText?.match(/\d[\d,\.]+/);
        const price = priceMatch ? Number(priceMatch[0].replace(/,/g, '')) : null;

        if (!title || !price) continue;

        items.push({
          product_name: title,
          site: 'noon.com',
          price,
          currency: priceEl.innerText.includes('AED') ? 'AED' : 'SAR',
          url: href,
          image: container.querySelector('img')?.src || null,
          raw: { priceRaw: priceEl.innerText }
        });
      }

      return items;
    });
  }

  // ---- Normalize + Dedupe --------------------------------------------------
  const seen = new Set();
  const final = [];

  for (const p of raw) {
    if (!p.url) continue;

    let normalizedUrl = p.url;
    try {
      const u = new URL(p.url);
      normalizedUrl = u.origin + u.pathname;
    } catch {}

    if (seen.has(normalizedUrl)) continue;
    seen.add(normalizedUrl);

    final.push({
      ...p,
      url: normalizedUrl,
      price: Number(p.price),
      currency: (p.currency || 'SAR').replace(/[^\w]/g, '').toUpperCase()
    });
  }

  const valid = validateResults(final, 'noon');
  logger.info('Noon scraper results', {
    source,
    beforeValidation: final.length,
    afterValidation: valid.length
  });

  return valid.slice(0, MAX_RESULTS);
}

// ---- Main Search -----------------------------------------------------------
async function search(query) {
  const searchUrl = `https://www.noon.com/saudi-en/search/?q=${encodeURIComponent(
    query.trim()
  )}`;

  try {
    return await retryWithBackoff(
      () => performSearch(query, searchUrl),
      {
        maxRetries: 2,
        initialDelay: 800,
        retryableErrors: ['timeout', 'ECONNRESET', 'ETIMEDOUT', 'Navigation', 'protocol timeout']
      }
    );
  } catch (error) {
    const info = classifyError(error);
    logger.error('Noon scraper failed', {
      query,
      error: error.message,
      errorType: info.type,
      retryable: info.retryable
    });
    return [];
  }
}

// ---- Internal: performSearch -----------------------------------------------
async function performSearch(query, searchUrl) {
  let browser, page;

  try {
    logger.debug('Starting Noon scrape', { query });

    browser = await puppeteer.launch({
      ...LAUNCH_OPTIONS,
      timeout: 60000,
      protocolTimeout: 90000,
      ignoreHTTPSErrors: true,
      dumpio: false
    });

    page = await browser.newPage();

    page.setUserAgent(process.env.PUPPETEER_USER_AGENT || DEFAULT_USER_AGENT);
    page.setViewport({ width: 1200, height: 800 });

    // Disable heavy page features
    await page.setBypassCSP(true);
    await page.setJavaScriptEnabled(true);

    const apiData = await interceptAndFetchJson(page, searchUrl);
    const results = await parseResults(page, apiData);

    return results;
  } finally {
    await safeClosePage(page, 'noon');
    await safeCloseBrowser(browser, 'noon');
  }
}

module.exports = { search, name: 'noon', site: 'noon.com' };

