# Workers and Cache Management

## Overview

This document describes the worker thread system and intelligent cache management features implemented in Looqta.

## Features

### 1. Intelligent Cache Rebuild

The system automatically detects new items and rebuilds cache when:
- **New items are found**: When scrapers discover products that weren't in the cached results
- **Price changes detected**: When product prices change significantly (>5%)
- **Items removed**: When products are no longer available (removed from search results)

#### Cache Comparison Logic

The cache utility (`src/utils/cache-utils.js`) provides:
- **Product comparison**: Compares products by URL or product_name + site combination
- **Change detection**: Identifies new items, updated items, and removed items
- **Smart merging**: Intelligently merges cached and new results, prioritizing new prices

#### Usage

Cache rebuild happens automatically during search operations. The system:
1. Compares new results with cached results
2. Detects changes (new items, price updates, removals)
3. Rebuilds cache if significant changes are detected
4. Logs rebuild decisions for monitoring

### 2. Worker Thread System

#### Worker Manager (`src/workers/worker-manager.js`)

Provides true parallelism for CPU-intensive scraping tasks using Node.js worker threads.

**Features:**
- Parallel execution of scrapers in isolated worker threads
- Configurable maximum concurrent workers
- Worker timeout protection
- Automatic cleanup and error handling

**Configuration:**
```javascript
const WorkerManager = require('./workers/worker-manager');

const manager = new WorkerManager({
  maxWorkers: 4,           // Maximum concurrent workers
  workerTimeout: 120000    // 2 minutes timeout per worker
});
```

**Usage:**
```javascript
// Run all scrapers in parallel using worker threads
const { results, scraperStatus } = await manager.runAllScrapers('iphone');
```

#### Scraper Worker (`src/workers/scraper-worker.js`)

Individual worker thread that runs a single scraper in isolation.

**Benefits:**
- True parallelism (not just async concurrency)
- Isolated execution (errors in one worker don't affect others)
- Better resource management for CPU-intensive tasks

**Note:** For I/O-bound tasks like Puppeteer scraping, the existing Promise.allSettled approach is already efficient. Worker threads are provided as an option for CPU-intensive processing.

### 3. Background Refresh Worker

#### Overview

Automatically refreshes cache for popular queries in the background, keeping results up-to-date without user requests.

**Features:**
- Periodic cache refresh (configurable interval)
- Popular queries tracking
- Concurrent refresh management
- Automatic cache rebuild when new items found

#### Configuration

Set via environment variables:
```bash
# Enable/disable background refresh (default: enabled)
ENABLE_BACKGROUND_REFRESH=true

# Refresh interval in minutes (default: 60)
BACKGROUND_REFRESH_INTERVAL_MINUTES=60

# Maximum concurrent refreshes (default: 2)
MAX_CONCURRENT_REFRESHES=2

# Popular queries to refresh (comma-separated)
POPULAR_QUERIES=iphone,laptop,headphones,smart watch
```

#### API Endpoints

**Get worker statistics:**
```bash
GET /api/workers/stats
```

**Manually trigger refresh:**
```bash
POST /api/workers/refresh
Content-Type: application/json

{
  "query": "iphone"
}
```

**Add popular query:**
```bash
POST /api/workers/popular-queries
Content-Type: application/json

{
  "query": "camera"
}
```

**Remove popular query:**
```bash
DELETE /api/workers/popular-queries/camera
```

## Cache Rebuild Logic

### When Cache is Rebuilt

1. **New Items Found**: Any new products discovered trigger a rebuild
2. **Price Changes**: Products with >5% price change trigger a rebuild
3. **Removed Items**: If >10% of cached items are removed, cache is rebuilt

### Cache Merge Strategy

When rebuilding:
- **New items**: Added to cache
- **Updated items**: Prices and details updated
- **Removed items**: Removed from cache (unless `keepRemovedItems` option is true)
- **Sorting**: Results sorted by price (ascending) to show best deals first

## Performance Considerations

### Worker Threads vs Async Concurrency

- **Async Concurrency (Current)**: Efficient for I/O-bound tasks like Puppeteer scraping
- **Worker Threads**: Better for CPU-intensive tasks, but adds overhead

**Recommendation**: For Puppeteer-based scrapers, the existing Promise.allSettled approach is optimal. Worker threads are available for future CPU-intensive processing needs.

### Background Refresh Impact

- Runs independently of user requests
- Limited concurrent refreshes prevent resource exhaustion
- Popular queries refreshed periodically to keep cache fresh
- Non-blocking: doesn't affect search performance

## Monitoring

### Logs

The system logs:
- Cache rebuild decisions and reasons
- Worker thread creation and completion
- Background refresh operations
- New items detected and cache updates

### Statistics

Query worker statistics:
```bash
curl http://localhost:4000/api/workers/stats
```

Returns:
```json
{
  "success": true,
  "stats": {
    "backgroundWorker": {
      "isRunning": true,
      "intervalMinutes": 60,
      "popularQueries": 3,
      "activeRefreshes": 0,
      "maxConcurrentRefreshes": 2
    },
    "workerManager": {
      "activeWorkers": 0,
      "maxWorkers": 4,
      "workerIds": []
    }
  }
}
```

## Best Practices

1. **Popular Queries**: Add frequently searched queries to popular queries list for automatic refresh
2. **Refresh Interval**: Balance freshness with resource usage (60 minutes is a good default)
3. **Concurrent Refreshes**: Limit concurrent refreshes to prevent overwhelming scrapers
4. **Monitoring**: Monitor logs for cache rebuild patterns and adjust thresholds if needed

## Recent Updates (2025-11-10)

- ✅ Cache rebuild logic fully implemented and tested
- ✅ Background refresh worker integrated into main server
- ✅ Worker management API endpoints added
- ✅ Cache comparison utilities with smart merging
- ✅ Automatic cache rebuild on new items and price changes

## Future Enhancements

- Queue system for worker thread management
- Adaptive refresh intervals based on query popularity
- Cache warming strategies
- Distributed worker system for horizontal scaling
- Cache statistics and analytics
- Automatic popular query detection based on search frequency
