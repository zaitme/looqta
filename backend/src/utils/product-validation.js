/**
 * Product Validation Pipeline
 * Implements PHASE 2: Data Integrity & Atomic Updates
 * 
 * Stages:
 * A - Schema Presence Check (Required fields)
 * B - Value Validation
 * C - Missing Non-Critical Fields (fill defaults)
 * D - De-duplication & Normalization
 * E - Enrichment
 */

const logger = require('./logger');
const crypto = require('crypto');

/**
 * Generate normalized product ID from site and site_product_id or URL
 */
function generateProductId(site, siteProductId, url) {
  if (site && siteProductId) {
    return crypto.createHash('md5').update(`${site}:${siteProductId}`).digest('hex').substring(0, 16);
  }
  if (site && url) {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      return crypto.createHash('md5').update(`${site}:${path}`).digest('hex').substring(0, 16);
    } catch (e) {
      return crypto.createHash('md5').update(`${site}:${url}`).digest('hex').substring(0, 16);
    }
  }
  return null;
}

/**
 * Extract site_product_id from URL
 */
function extractSiteProductId(url, site) {
  if (!url || !site) return null;
  try {
    const urlObj = new URL(url);
    // Extract product ID from common patterns
    // Amazon: /dp/B08XXX or /gp/product/B08XXX
    // Noon: /p-XXXXX
    const path = urlObj.pathname;
    if (site.toLowerCase().includes('amazon')) {
      const match = path.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
      return match ? match[1] : path.split('/').filter(p => p.length > 5).pop();
    }
    if (site.toLowerCase().includes('noon')) {
      const match = path.match(/\/p-([^\/]+)/);
      return match ? match[1] : path.split('/').filter(p => p.length > 5).pop();
    }
    // Generic: use last meaningful path segment
    return path.split('/').filter(p => p && p.length > 3).pop() || null;
  } catch (e) {
    return null;
  }
}

/**
 * Normalize title (trim, remove extra whitespace, unicode normalization)
 */
function normalizeTitle(title) {
  if (!title) return null;
  return title
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .normalize('NFKC'); // Unicode normalization
}

/**
 * Normalize price to numeric
 */
function normalizePrice(price) {
  if (typeof price === 'number') {
    return isFinite(price) && price > 0 ? parseFloat(price.toFixed(2)) : null;
  }
  if (typeof price === 'string') {
    // Remove currency symbols, commas, spaces
    const cleaned = price.replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isFinite(parsed) && parsed > 0 ? parseFloat(parsed.toFixed(2)) : null;
  }
  return null;
}

/**
 * Validate image URL
 */
function validateImageUrl(imageUrl) {
  if (!imageUrl) return null;
  // Check if it's a placeholder or invalid URL
  const placeholderPatterns = [
    /placeholder/i,
    /no-image/i,
    /default/i,
    /^data:image\/svg/i // SVG data URLs are often placeholders
  ];
  
  if (placeholderPatterns.some(pattern => pattern.test(imageUrl))) {
    return null;
  }
  
  // Must be absolute URL
  if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
    return null;
  }
  
  try {
    new URL(imageUrl);
    return imageUrl;
  } catch (e) {
    return null;
  }
}

/**
 * Validate product URL
 */
function validateProductUrl(url) {
  if (!url) return null;
  if (!url.startsWith('https://') && !url.startsWith('http://')) {
    return null;
  }
  try {
    new URL(url);
    return url;
  } catch (e) {
    return null;
  }
}

/**
 * Validate currency
 */
function validateCurrency(currency) {
  if (!currency) return 'SAR';
  const normalized = currency.toUpperCase().trim();
  // Accept SAR, USD, EUR, AED, etc.
  if (normalized.length === 3 && /^[A-Z]{3}$/.test(normalized)) {
    return normalized;
  }
  return 'SAR'; // Default to SAR for KSA
}

/**
 * STAGE A: Schema Presence Check
 */
function validateSchema(raw) {
  const required = ['product_name', 'price', 'url', 'site'];
  const missing = required.filter(field => !raw[field]);
  
  if (missing.length > 0) {
    throw new Error(`Schema validation failed: Missing required fields: ${missing.join(', ')}`);
  }
  
  return true;
}

/**
 * STAGE B: Value Validation
 */
function validateValues(raw) {
  const errors = [];
  
  // Price validation
  const price = normalizePrice(raw.price);
  if (!price || price <= 0) {
    errors.push('Invalid price: must be a positive number');
  }
  
  // URL validation
  const url = validateProductUrl(raw.url);
  if (!url) {
    errors.push('Invalid product_url: must be absolute URL');
  }
  
  // Image URL validation (optional but if present must be valid)
  if (raw.image_url && !validateImageUrl(raw.image_url)) {
    // Don't fail, just set to null
    raw.image_url = null;
  }
  
  if (errors.length > 0) {
    throw new Error(`Value validation failed: ${errors.join('; ')}`);
  }
  
  return { price, url };
}

/**
 * STAGE C: Fill Missing Non-Critical Fields
 */
function fillDefaults(raw) {
  return {
    seller_rating: raw.seller_rating || null,
    seller_rating_count: raw.seller_rating_count || 0,
    seller_location: raw.seller_location || null,
    shipping_estimate: raw.shipping_estimate || null,
    seller_type: raw.seller_type || null,
    source_sku: raw.source_sku || null,
    shipping_info: raw.shipping_info || null
  };
}

/**
 * STAGE D: De-duplication & Normalization
 */
function normalizeRecord(raw, validated) {
  const site = raw.site.toLowerCase().trim();
  const siteProductId = raw.site_product_id || extractSiteProductId(validated.url, site);
  const productId = generateProductId(site, siteProductId, validated.url);
  
  return {
    // Core fields
    product_name: normalizeTitle(raw.product_name),
    site: site,
    site_product_id: siteProductId,
    product_id: productId,
    price_amount: validated.price,
    price_currency: validateCurrency(raw.currency || raw.price_currency),
    url: validated.url,
    image_url: raw.image_url ? validateImageUrl(raw.image_url) : null,
    affiliate_link: raw.affiliate_link || raw.affiliate_url || validated.url,
    
    // Optional fields (from Stage C)
    ...fillDefaults(raw),
    
    // Metadata
    is_valid: true, // Set to true only after passing all validation stages
    last_checked_at: new Date()
  };
}

/**
 * STAGE E: Enrichment
 */
function enrichRecord(normalized) {
  // Derive flags
  const isFulfilledByRetailer = normalized.seller_type === 'Fulfilled by Amazon' || 
                                normalized.seller_type === 'Noon Fulfilled' ||
                                normalized.fulfilled_by === 'retailer';
  
  // Parse shipping estimate days
  let shippingEstimateDays = null;
  if (normalized.shipping_estimate) {
    const match = normalized.shipping_estimate.match(/(\d+)/);
    if (match) {
      shippingEstimateDays = parseInt(match[1]);
    }
  }
  
  // Infer VAT included (assume yes for KSA)
  const vatIncluded = true;
  
  return {
    ...normalized,
    is_fulfilled_by_retailer: isFulfilledByRetailer,
    shipping_estimate_days: shippingEstimateDays || normalized.shipping_estimate_days,
    vat_included: vatIncluded,
    currency_symbol: 'SAR' // KSA locale
  };
}

/**
 * Main validation pipeline
 * @param {Object} raw - Raw scraped product data
 * @param {Object} metadata - Optional metadata (site, query, etc.)
 * @returns {Object} Validated and normalized product record
 */
function validateRecord(raw, metadata = {}) {
  const validationContext = {
    site: raw.site || metadata.site,
    query: metadata.query,
    rawSnapshot: JSON.stringify(raw)
  };
  
  try {
    // Stage A: Schema Presence Check
    validateSchema(raw);
    
    // Stage B: Value Validation
    const validated = validateValues(raw);
    
    // Stage C: Fill Defaults (done in normalizeRecord)
    
    // Stage D: Normalization
    const normalized = normalizeRecord(raw, validated);
    
    // Stage E: Enrichment
    const enriched = enrichRecord(normalized);
    
    logger.debug('Product validation passed', {
      productId: enriched.product_id,
      site: enriched.site,
      productName: enriched.product_name?.substring(0, 50)
    });
    
    return enriched;
    
  } catch (error) {
    logger.warn('Product validation failed', {
      ...validationContext,
      error: error.message,
      productName: raw.product_name?.substring(0, 50)
    });
    throw error;
  }
}

/**
 * Validate multiple records (batch)
 * @param {Array} rawRecords - Array of raw scraped products
 * @param {Object} metadata - Optional metadata
 * @returns {Object} { valid: [], invalid: [] }
 */
function validateRecords(rawRecords, metadata = {}) {
  const valid = [];
  const invalid = [];
  
  for (const raw of rawRecords) {
    try {
      const validated = validateRecord(raw, metadata);
      valid.push(validated);
    } catch (error) {
      invalid.push({
        raw,
        error: error.message
      });
    }
  }
  
  return { valid, invalid };
}

module.exports = {
  validateRecord,
  validateRecords,
  generateProductId,
  normalizeTitle,
  normalizePrice,
  validateCurrency,
  validateImageUrl,
  validateProductUrl
};
