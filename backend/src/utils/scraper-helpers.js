/**
 * Helper utilities for scrapers
 * Provides retry logic, browser management, and error handling
 */

const logger = require('./logger');

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @returns {Promise} - Result of the function
 */
async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    retryableErrors = ['timeout', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND']
  } = options;

  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if error is retryable
      const isRetryable = retryableErrors.some(pattern => 
        error.message && error.message.toLowerCase().includes(pattern.toLowerCase())
      );
      
      // Don't retry on DNS errors or authentication failures
      const isNonRetryable = error.message && (
        error.message.includes('ERR_NAME_NOT_RESOLVED') ||
        error.message.includes('DNS_PROBE_FINISHED_NXDOMAIN') ||
        error.message.includes('NOAUTH') ||
        error.message.includes('authentication')
      );
      
      if (isNonRetryable || attempt === maxRetries || !isRetryable) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelay * Math.pow(backoffMultiplier, attempt),
        maxDelay
      );
      
      logger.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`, {
        error: error.message,
        attempt: attempt + 1
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Safely close browser instance
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} scraperName - Name of scraper for logging
 */
async function safeCloseBrowser(browser, scraperName = 'unknown') {
  if (!browser) return;
  
  try {
    const pages = await browser.pages().catch(() => []);
    for (const page of pages) {
      try {
        await page.close().catch(() => {});
      } catch (e) {
        logger.debug(`Error closing page in ${scraperName}`, { error: e.message });
      }
    }
    
    await browser.close();
    logger.debug(`Browser closed successfully for ${scraperName}`);
  } catch (error) {
    logger.warn(`Error closing browser for ${scraperName}`, { 
      error: error.message 
    });
  }
}

/**
 * Safely close page instance
 * @param {Object} page - Puppeteer page instance
 * @param {string} scraperName - Name of scraper for logging
 */
async function safeClosePage(page, scraperName = 'unknown') {
  if (!page) return;
  
  try {
    await page.close();
    logger.debug(`Page closed successfully for ${scraperName}`);
  } catch (error) {
    logger.debug(`Error closing page for ${scraperName}`, { 
      error: error.message 
    });
  }
}

/**
 * Check if error is retryable
 * @param {Error} error - Error to check
 * @returns {boolean} - True if error is retryable
 */
function isRetryableError(error) {
  if (!error || !error.message) return false;
  
  const retryablePatterns = [
    'timeout',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EPIPE',
    'protocol timeout',
    'Navigation timeout'
  ];
  
  const nonRetryablePatterns = [
    'ERR_NAME_NOT_RESOLVED',
    'DNS_PROBE_FINISHED_NXDOMAIN',
    'NOAUTH',
    'authentication',
    'SyntaxError',
    'ReferenceError',
    'TypeError'
  ];
  
  const message = error.message.toLowerCase();
  
  // Check non-retryable first
  if (nonRetryablePatterns.some(pattern => message.includes(pattern.toLowerCase()))) {
    return false;
  }
  
  // Check retryable
  return retryablePatterns.some(pattern => message.includes(pattern.toLowerCase()));
}

/**
 * Classify error type
 * @param {Error} error - Error to classify
 * @returns {Object} - { type: string, retryable: boolean, message: string }
 */
function classifyError(error) {
  if (!error || !error.message) {
    return { type: 'unknown', retryable: false, message: 'Unknown error' };
  }
  
  const message = error.message.toLowerCase();
  
  if (message.includes('timeout') || message.includes('timed out')) {
    return { type: 'timeout', retryable: true, message: 'Request timed out' };
  }
  
  if (message.includes('dns') || message.includes('name_not_resolved')) {
    return { type: 'dns', retryable: false, message: 'DNS resolution failed' };
  }
  
  if (message.includes('connection') || message.includes('econnreset') || message.includes('epipe')) {
    return { type: 'connection', retryable: true, message: 'Connection error' };
  }
  
  if (message.includes('protocol timeout')) {
    return { type: 'protocol_timeout', retryable: true, message: 'Protocol timeout' };
  }
  
  if (message.includes('syntax') || message.includes('reference') || message.includes('type')) {
    return { type: 'code_error', retryable: false, message: 'Code error' };
  }
  
  return { type: 'unknown', retryable: isRetryableError(error), message: error.message };
}

module.exports = {
  retryWithBackoff,
  safeCloseBrowser,
  safeClosePage,
  isRetryableError,
  classifyError
};
