/**
 * Cache utility functions for comparing and merging results
 */

const logger = require('./logger');

/**
 * Compare two product results to check if they're the same
 * Products are considered the same if they have the same URL or same product_name + site combination
 */
function areProductsEqual(product1, product2) {
  if (!product1 || !product2) return false;
  
  // If both have URLs, compare by URL (most reliable)
  if (product1.url && product2.url) {
    return product1.url === product2.url;
  }
  
  // Fallback: compare by product_name + site
  if (product1.product_name && product2.product_name && 
      product1.site && product2.site) {
    return product1.product_name.toLowerCase().trim() === product2.product_name.toLowerCase().trim() &&
           product1.site === product2.site;
  }
  
  return false;
}

/**
 * Get a unique key for a product (for comparison)
 * Uses URL if available, otherwise falls back to site + product_name
 */
function getProductKey(product) {
  if (!product) return null;
  
  // Prefer URL as it's most reliable
  if (product.url) {
    try {
      // Normalize URL (remove query params, hash, etc.)
      const url = new URL(product.url);
      return `${product.site || 'unknown'}:${url.origin}${url.pathname}`;
    } catch (e) {
      // Invalid URL, use as-is
      return `${product.site || 'unknown'}:${product.url}`;
    }
  }
  
  // Fallback to site + product_name
  if (product.site && product.product_name) {
    return `${product.site}:${product.product_name.toLowerCase().trim()}`;
  }
  
  return null;
}

/**
 * Normalize product name for case-insensitive comparison
 * Removes extra whitespace, converts to lowercase, and handles special characters
 */
function normalizeProductName(name) {
  if (!name) return '';
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check if two product names match (case-insensitive with fuzzy matching)
 */
function productNamesMatch(name1, name2) {
  if (!name1 || !name2) return false;
  const norm1 = normalizeProductName(name1);
  const norm2 = normalizeProductName(name2);
  
  // Exact match after normalization
  if (norm1 === norm2) return true;
  
  // Check if one contains the other (for minor variations)
  if (norm1.length > 10 && norm2.length > 10) {
    const longer = norm1.length > norm2.length ? norm1 : norm2;
    const shorter = norm1.length > norm2.length ? norm2 : norm1;
    // If shorter name is 80% contained in longer, consider it a match
    if (longer.includes(shorter) && shorter.length / longer.length > 0.8) {
      return true;
    }
  }
  
  return false;
}

/**
 * Find new items in newResults that don't exist in cachedResults
 * Uses improved case-insensitive matching algorithm
 * @param {Array} cachedResults - Previously cached results
 * @param {Array} newResults - Newly scraped results
 * @returns {Object} - { newItems: Array, updatedItems: Array, removedItems: Array }
 */
function findNewAndUpdatedItems(cachedResults, newResults) {
  const cached = cachedResults || [];
  const newItems = [];
  const updatedItems = [];
  const cachedMap = new Map();
  
  // Create a map of cached items using normalized keys for case-insensitive lookup
  cached.forEach((item, index) => {
    const key = getProductKey(item);
    if (key) {
      cachedMap.set(key, { item, index });
    }
  });
  
  // Check new results against cached using improved matching
  const foundInCache = new Set();
  newResults.forEach(newItem => {
    const key = getProductKey(newItem);
    if (!key) {
      // No valid key, treat as new item
      newItems.push(newItem);
      return;
    }
    
    const cachedEntry = cachedMap.get(key);
    
    if (cachedEntry) {
      foundInCache.add(key);
      // Check if price or other details changed
      const cachedItem = cachedEntry.item;
      const priceChanged = Math.abs((cachedItem.price || 0) - (newItem.price || 0)) > 0.01;
      const currencyChanged = cachedItem.currency !== newItem.currency;
      const nameChanged = !productNamesMatch(cachedItem.product_name, newItem.product_name);
      
      if (priceChanged || currencyChanged || nameChanged) {
        updatedItems.push({
          old: cachedItem,
          new: newItem
        });
      }
    } else {
      // Try fuzzy matching by product name if URL doesn't match
      let foundMatch = false;
      if (newItem.product_name && newItem.site) {
        for (const [cachedKey, cachedEntry] of cachedMap.entries()) {
          const cachedItem = cachedEntry.item;
          // Check if same site and product names match (case-insensitive)
          if (cachedItem.site === newItem.site && 
              productNamesMatch(cachedItem.product_name, newItem.product_name)) {
            foundMatch = true;
            foundInCache.add(cachedKey);
            // Check for updates
            const priceChanged = Math.abs((cachedItem.price || 0) - (newItem.price || 0)) > 0.01;
            const currencyChanged = cachedItem.currency !== newItem.currency;
            if (priceChanged || currencyChanged) {
              updatedItems.push({
                old: cachedItem,
                new: newItem
              });
            }
            break;
          }
        }
      }
      
      if (!foundMatch) {
        // This is a completely new item
        newItems.push(newItem);
      }
    }
  });
  
  // Find removed items (items in cache but not in new results)
  const removedItems = [];
  cached.forEach(item => {
    const key = getProductKey(item);
    if (key && !foundInCache.has(key)) {
      // Double-check with fuzzy matching
      let stillExists = false;
      if (item.product_name && item.site) {
        for (const newItem of newResults) {
          if (newItem.site === item.site && 
              productNamesMatch(newItem.product_name, item.product_name)) {
            stillExists = true;
            break;
          }
        }
      }
      if (!stillExists) {
        removedItems.push(item);
      }
    }
  });
  
  return {
    newItems,
    updatedItems,
    removedItems,
    hasChanges: newItems.length > 0 || updatedItems.length > 0 || removedItems.length > 0
  };
}

/**
 * Delta Caching Algorithm - Efficiently merges cached and new results
 * 
 * Strategy:
 * 1. Add all new items (items not in cache)
 * 2. Update existing items with new data (price changes, etc.)
 * 3. Remove items that are no longer in new results (no longer available)
 * 
 * This ensures cache always reflects current availability while preserving
 * historical data when appropriate.
 * 
 * @param {Array} cachedResults - Previously cached results
 * @param {Array} newResults - Newly scraped results
 * @param {Object} options - Merge options
 * @returns {Array} - Delta-merged results
 */
function mergeResults(cachedResults, newResults, options = {}) {
  const {
    keepRemovedItems = false, // Whether to keep items that were removed from new results
    prioritizeNewPrices = true, // Whether to prioritize new prices over cached prices
    removeStaleThreshold = 0 // Percentage threshold for removing stale items (0 = always remove)
  } = options;
  
  const cached = cachedResults || [];
  const newItems = newResults || [];
  
  // Create maps for efficient lookup
  const cachedMap = new Map();
  const newMap = new Map();
  
  // Build cached map: key -> product
  cached.forEach(item => {
    const key = getProductKey(item);
    if (key) {
      cachedMap.set(key, item);
    }
  });
  
  // Build new map: key -> product
  newItems.forEach(item => {
    const key = getProductKey(item);
    if (key) {
      newMap.set(key, item);
    }
  });
  
  // Step 1: Start with all new results (current availability)
  const merged = [];
  const processedKeys = new Set();
  
  // Step 2: Process new results - add new items and update existing ones
  newItems.forEach(newItem => {
    const key = getProductKey(newItem);
    if (!key) return;
    
    processedKeys.add(key);
    const cachedItem = cachedMap.get(key);
    
    if (cachedItem) {
      // Item exists in cache - merge with new data (prioritize new prices)
      const mergedItem = {
        ...cachedItem, // Start with cached data
        ...newItem,    // Override with new data
        // Special handling for price: use new price if available, otherwise keep cached
        price: prioritizeNewPrices && newItem.price ? newItem.price : (newItem.price || cachedItem.price),
        // Keep the most recent image
        image: newItem.image || cachedItem.image,
        // Update timestamp if tracking
        _lastSeen: Date.now(),
        _updated: cachedItem._lastSeen || Date.now()
      };
      merged.push(mergedItem);
    } else {
      // Completely new item - add it
      merged.push({
        ...newItem,
        _firstSeen: Date.now(),
        _lastSeen: Date.now()
      });
    }
  });
  
  // Step 3: Handle removed items (in cache but not in new results)
  const removedItems = [];
  cached.forEach(item => {
    const key = getProductKey(item);
    if (key && !processedKeys.has(key)) {
      removedItems.push(item);
    }
  });
  
  // Step 4: Decide whether to keep removed items
  if (keepRemovedItems && removedItems.length > 0) {
    // Only keep removed items if they're recent (less than threshold percentage)
    const removalPercentage = cached.length > 0 ? (removedItems.length / cached.length) * 100 : 0;
    
    if (removalPercentage <= removeStaleThreshold || removeStaleThreshold === 0) {
      logger.debug('Keeping removed items in cache', { 
        count: removedItems.length,
        percentage: removalPercentage.toFixed(2)
      });
      // Mark as potentially stale but keep them
      removedItems.forEach(item => {
        merged.push({
          ...item,
          _removed: true,
          _lastSeen: item._lastSeen || Date.now()
        });
      });
    } else {
      logger.debug('Removing stale items from cache', { 
        count: removedItems.length,
        percentage: removalPercentage.toFixed(2),
        threshold: removeStaleThreshold
      });
    }
  }
  
  // Step 5: Sort by price (ascending) to show best deals first
  merged.sort((a, b) => {
    // Put removed items at the end
    if (a._removed && !b._removed) return 1;
    if (!a._removed && b._removed) return -1;
    
    // Sort by price
    if (!a.price && !b.price) return 0;
    if (!a.price) return 1;
    if (!b.price) return -1;
    return a.price - b.price;
  });
  
  logger.debug('Delta cache merge completed', {
    cachedCount: cached.length,
    newCount: newItems.length,
    mergedCount: merged.length,
    added: newItems.length - (cached.length - removedItems.length),
    removed: removedItems.length,
    keptRemoved: keepRemovedItems && removedItems.length > 0
  });
  
  return merged;
}

/**
 * Check if cache should be rebuilt based on new items found
 * @param {Array} cachedResults - Previously cached results
 * @param {Array} newResults - Newly scraped results
 * @param {Object} options - Options for rebuild decision
 * @returns {Object} - { shouldRebuild: boolean, reason: string, comparison: Object }
 */
function shouldRebuildCache(cachedResults, newResults, options = {}) {
  const {
    minNewItemsThreshold = 1, // Minimum new items to trigger rebuild
    requirePriceChanges = false // Whether price changes alone should trigger rebuild
  } = options;
  
  const comparison = findNewAndUpdatedItems(cachedResults, newResults);
  
  // Always rebuild if there are new items
  if (comparison.newItems.length >= minNewItemsThreshold) {
    return {
      shouldRebuild: true,
      reason: `Found ${comparison.newItems.length} new item(s)`,
      comparison
    };
  }
  
  // Rebuild if there are significant price updates
  if (requirePriceChanges && comparison.updatedItems.length > 0) {
    const significantPriceChanges = comparison.updatedItems.filter(update => {
      const oldPrice = update.old.price || 0;
      const newPrice = update.new.price || 0;
      if (oldPrice === 0 || newPrice === 0) return true; // New price info is significant
      const percentChange = Math.abs((newPrice - oldPrice) / oldPrice) * 100;
      return percentChange > 5; // More than 5% price change
    });
    
    if (significantPriceChanges.length > 0) {
      return {
        shouldRebuild: true,
        reason: `Found ${significantPriceChanges.length} item(s) with significant price changes`,
        comparison
      };
    }
  }
  
  // Rebuild if items were removed (products no longer available)
  if (comparison.removedItems.length > 0 && comparison.removedItems.length >= cachedResults.length * 0.1) {
    return {
      shouldRebuild: true,
      reason: `Found ${comparison.removedItems.length} removed item(s) (${Math.round(comparison.removedItems.length / cachedResults.length * 100)}% of cache)`,
      comparison
    };
  }
  
  return {
    shouldRebuild: false,
    reason: 'No significant changes detected',
    comparison
  };
}

module.exports = {
  areProductsEqual,
  findNewAndUpdatedItems,
  mergeResults,
  shouldRebuildCache,
  getProductKey,
  normalizeProductName,
  productNamesMatch
};
