# Delta Caching Algorithm Implementation

## Overview
Implemented an efficient delta caching algorithm that handles cache updates intelligently by:
1. **Adding new results** - Products not previously in cache
2. **Updating existing results** - Products with changed prices or data
3. **Removing stale results** - Products no longer returned by scrapers (no longer available)

## Problem Statement

### Previous Issues:
- Cache would accumulate stale products that were no longer available
- No efficient way to remove products that disappeared from search results
- Cache could grow indefinitely with outdated data

### Solution:
Delta caching algorithm that maintains cache state based on current scraper results, ensuring cache always reflects current product availability.

---

## Algorithm Design

### Core Strategy

```
Delta Cache Merge Process:
1. Start with all NEW results (current availability)
2. For each new result:
   - If exists in cache → Update with new data (merge)
   - If new → Add to cache
3. For each cached result:
   - If NOT in new results → Mark as removed/stale
   - Remove if threshold exceeded
4. Sort by price (best deals first)
```

### Key Functions

#### `getProductKey(product)`
Creates a unique identifier for products:
- **Primary**: `site:normalized_url` (most reliable)
- **Fallback**: `site:product_name` (when URL unavailable)

#### `mergeResults(cachedResults, newResults, options)`
Main delta caching function:

**Parameters:**
- `cachedResults`: Previously cached products
- `newResults`: Newly scraped products
- `options`:
  - `keepRemovedItems`: Whether to keep products not in new results (default: false)
  - `prioritizeNewPrices`: Use new prices over cached (default: true)
  - `removeStaleThreshold`: Percentage threshold for removing stale items (default: 0)

**Process:**
1. **Build Maps**: Create lookup maps for O(1) access
2. **Process New Results**:
   - Add completely new products
   - Update existing products with new data
3. **Handle Removed Items**:
   - Identify products in cache but not in new results
   - Remove them (or keep if threshold allows)
4. **Sort**: Order by price (ascending)

---

## Implementation Details

### Product Key Generation

```javascript
function getProductKey(product) {
  // Prefer URL (most reliable)
  if (product.url) {
    const url = new URL(product.url);
    return `${product.site}:${url.origin}${url.pathname}`;
  }
  
  // Fallback to site + name
  return `${product.site}:${product.product_name.toLowerCase().trim()}`;
}
```

### Delta Merge Logic

```javascript
// Step 1: Process new results
newItems.forEach(newItem => {
  const key = getProductKey(newItem);
  const cachedItem = cachedMap.get(key);
  
  if (cachedItem) {
    // Merge: keep cached data, update with new data
    merged.push({ ...cachedItem, ...newItem });
  } else {
    // New item: add it
    merged.push(newItem);
  }
});

// Step 2: Handle removed items
cached.forEach(item => {
  const key = getProductKey(item);
  if (!newMap.has(key)) {
    // Item no longer available - remove it
    // (or keep if keepRemovedItems=true and threshold allows)
  }
});
```

---

## Benefits

### 1. **Accurate Availability**
- Cache always reflects current product availability
- No stale products cluttering results

### 2. **Efficient Updates**
- Only processes changed items
- O(n) complexity with Map lookups

### 3. **Price Accuracy**
- Automatically updates prices when scraped
- Prioritizes new prices over cached

### 4. **Automatic Cleanup**
- Removes unavailable products automatically
- Prevents cache bloat

---

## Usage Examples

### Basic Delta Caching (Remove Stale Items)
```javascript
const finalResults = mergeResults(cachedResults, newResults, {
  keepRemovedItems: false,  // Remove items not in new results
  prioritizeNewPrices: true // Use new prices
});
```

### Conservative Caching (Keep Some Stale Items)
```javascript
const finalResults = mergeResults(cachedResults, newResults, {
  keepRemovedItems: true,
  removeStaleThreshold: 10 // Keep removed items if < 10% of cache
});
```

---

## Integration Points

### Search Route (`/api/search`)
- Uses delta caching when cache exists
- Automatically removes stale products
- Updates prices and product data

### Streaming Search Route (`/api/search/stream`)
- Applies delta caching after all scrapers complete
- Streams updates as they occur
- Maintains cache consistency

---

## Performance Characteristics

### Time Complexity
- **O(n + m)** where n = cached items, m = new items
- Map lookups: O(1)
- Sorting: O(k log k) where k = merged items

### Space Complexity
- **O(n + m)** for maps and merged array
- Efficient memory usage

---

## Testing Scenarios

### Scenario 1: New Products Added
- **Input**: Cache has 10 products, scraper returns 12 products (2 new)
- **Output**: Cache updated with 12 products (2 new added)

### Scenario 2: Products Removed
- **Input**: Cache has 10 products, scraper returns 8 products
- **Output**: Cache updated with 8 products (2 removed)

### Scenario 3: Prices Updated
- **Input**: Cache has product at $100, scraper returns same product at $95
- **Output**: Cache updated with new price $95

### Scenario 4: Mixed Changes
- **Input**: Cache has 10 products, scraper returns 12 products (3 new, 1 removed, 2 price changes)
- **Output**: Cache updated with 12 products (3 added, 1 removed, 2 updated)

---

## Configuration

### Environment Variables
- `CACHE_TTL_SECONDS`: Cache expiration time (default: 43200 = 12 hours)

### Options
- `keepRemovedItems`: Whether to keep products not in new results
- `removeStaleThreshold`: Percentage threshold for removing stale items
- `prioritizeNewPrices`: Whether to use new prices over cached

---

## Monitoring

### Logging
The algorithm logs:
- Number of cached vs new items
- Items added/removed/updated
- Merge statistics

### Metrics to Track
- Cache hit rate
- Items added per update
- Items removed per update
- Price change frequency

---

## Future Enhancements

1. **Gradual Removal**: Keep removed items for N days before removing
2. **Price History**: Track price changes over time
3. **Availability Tracking**: Track when products become unavailable
4. **Smart Thresholds**: Dynamic thresholds based on product category

---

## Files Modified

1. `/opt/looqta/backend/src/utils/cache-utils.js` - Added delta caching algorithm
2. `/opt/looqta/backend/src/routes/search.js` - Integrated delta caching
3. `/opt/looqta/backend/src/routes/search-stream.js` - Integrated delta caching

---

**Status**: ✅ Delta caching algorithm implemented and integrated
