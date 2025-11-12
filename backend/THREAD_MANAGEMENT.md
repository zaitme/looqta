# Thread Management and Parallel Execution

## Overview

Looqta achieves high performance through parallel execution of scrapers. This document explains how parallelism is achieved in Node.js and the implementation details.

## How It Works

Node.js uses an **event-driven, non-blocking I/O model**. While Node.js doesn't have traditional threads like other languages, it achieves parallelism through:

1. **Event Loop**: Handles async operations concurrently
2. **Separate Processes**: Puppeteer launches separate Chrome processes
3. **Worker Threads**: Available for CPU-intensive tasks (optional)
4. **Non-blocking I/O**: Network and file operations don't block

## Current Implementation

### Parallel Scraper Execution

**Primary Method: Promise.allSettled()**
```javascript
// All scrapers run simultaneously
const scraperPromises = scrapers.map(async (scraper) => {
  return await scraper.search(q);
});

// Wait for all to complete (they run in parallel)
const results = await Promise.allSettled(scraperPromises);
```

**Why This Works:**
- Each `scraper.search()` call is async and non-blocking
- Puppeteer launches **separate Chrome browser processes**
- Node.js event loop handles multiple async operations concurrently
- **True parallelism** achieved through separate processes

### Streaming Results

**Server-Sent Events (SSE)**
```javascript
// Results sent as soon as each scraper completes
scraperPromises.forEach(async (promise) => {
  const results = await promise;
  // Send immediately via SSE
  sendEvent('results', { scraper, results });
});
```

**Benefits:**
- Users see results as soon as each scraper finishes
- No waiting for all scrapers to complete
- Better perceived performance
- Real-time status updates

## Performance Comparison

### Sequential Execution (Before)
```
Time 0s:   Start Amazon scraper
Time 15s:  Amazon completes
Time 15s:  Start Noon scraper
Time 35s:  Noon completes
Total: 35 seconds
```

### Parallel Execution (Current)
```
Time 0s:   Start both scrapers simultaneously
Time 15s:  Amazon completes → Results appear
Time 20s:  Noon completes → Results appear
Total: 20 seconds (time of slowest scraper)
```

### Streaming (Enhanced)
```
Time 0s:   User searches, both scrapers start
Time 10s:  First results appear (Amazon or Noon)
Time 15s:  Amazon completes → All Amazon results
Time 20s:  Noon completes → All Noon results
User sees first results: ~10-15 seconds
```

## Architecture

```
User Request
    ↓
Express Router
    ↓
┌─────────────────────────────────────┐
│  Parallel Scraper Execution         │
│  (Promise.allSettled)                │
│                                     │
│  ┌─────────────┐  ┌─────────────┐ │
│  │ Amazon      │  │ Noon         │ │
│  │ Scraper     │  │ Scraper      │ │
│  │             │  │              │ │
│  │ Chrome      │  │ Chrome       │ │
│  │ Process 1   │  │ Process 2    │ │
│  │             │  │              │ │
│  │ ~15-20s     │  │ ~15-25s      │ │
│  └─────────────┘  └─────────────┘ │
│        ↓                 ↓          │
│    Results          Results         │
│        ↓                 ↓          │
│    SSE Stream → User sees results immediately
└─────────────────────────────────────┘
```

## Worker Thread System (Optional)

### When to Use Worker Threads

**Worker threads are NOT needed for current scrapers because:**
- ✅ Scrapers are **I/O-bound** (network requests, DOM parsing)
- ✅ Puppeteer already launches **separate Chrome processes**
- ✅ Node.js event loop handles async I/O efficiently
- ✅ Worker threads add overhead without benefit for I/O operations

**Worker threads WOULD be useful for:**
- CPU-intensive tasks (image processing, heavy computations)
- Blocking operations that can't be made async
- Tasks that don't already spawn separate processes

### Worker Thread Implementation

**Available but not actively used:**
- `backend/src/workers/worker-manager.js` - Worker thread manager
- `backend/src/workers/scraper-worker.js` - Individual worker thread

**Usage (if needed):**
```javascript
const WorkerManager = require('./workers/worker-manager');
const manager = new WorkerManager({ maxWorkers: 4 });
const { results, scraperStatus } = await manager.runAllScrapers('iphone');
```

## Background Workers

### Background Refresh Worker

**Purpose**: Keep popular queries fresh without user requests

**Implementation:**
- Runs independently of user requests
- Refreshes cache at configurable intervals (default: 60 minutes)
- Manages concurrent refreshes (max 2 at once)
- Non-blocking: doesn't affect search performance

**Code**: `backend/src/workers/background-refresh-worker.js`

## Testing Parallel Execution

### Verify Parallel Execution
```bash
cd backend
node -e "
const start = Date.now();
const amazon = require('./src/scrapers/amazon');
const noon = require('./src/scrapers/noon');

Promise.allSettled([amazon.search('iphone'), noon.search('iphone')])
  .then(([a, n]) => {
    console.log('Total time:', Date.now() - start, 'ms');
    console.log('Amazon:', a.status === 'fulfilled' ? a.value.length : 'failed');
    console.log('Noon:', n.status === 'fulfilled' ? n.value.length : 'failed');
  });
"
```

### Expected Output
- **Sequential**: ~30-45 seconds
- **Parallel**: ~15-30 seconds (time of slowest scraper)
- **Improvement**: ~40-50% faster

## Performance Metrics

### Current Performance
- **Amazon Scraper**: ~15-20 seconds
- **Noon Scraper**: ~15-25 seconds
- **Parallel Total**: ~15-30 seconds
- **First Results**: ~10-15 seconds (streaming)
- **Cache Hit**: <100ms

### Resource Usage
- **Memory**: ~200-300MB per Chrome process
- **CPU**: Moderate during scraping
- **Network**: Depends on page size and images

## Best Practices

1. **Use Parallel Execution**: Always run scrapers in parallel
2. **Stream Results**: Use SSE for better UX
3. **Cache Aggressively**: Cache results to reduce scraping
4. **Monitor Performance**: Track scraper execution times
5. **Handle Errors Gracefully**: One scraper failure shouldn't block others

## Future Enhancements

### If More Parallelism Needed

1. **Cluster Mode** (for multi-core scaling)
   ```javascript
   const cluster = require('cluster');
   // Useful for scaling across CPU cores
   ```

2. **Queue System** (for rate limiting)
   ```javascript
   const Bull = require('bull');
   // Useful for managing scraper jobs
   ```

3. **Worker Threads** (for CPU-intensive tasks)
   ```javascript
   const { Worker } = require('worker_threads');
   // Only if CPU-bound processing needed
   ```

## Conclusion

The current implementation achieves **optimal performance** through:
- ✅ Async/await with Promise.allSettled (parallel execution)
- ✅ Separate Chrome processes per scraper (true parallelism)
- ✅ Non-blocking I/O operations
- ✅ Streaming results via SSE (better UX)
- ✅ Background workers (cache refresh)

**No additional thread management needed** - Node.js event loop + separate processes provide optimal performance for web scraping use case.

---

**Last Updated**: 2025-11-10
**Status**: ✅ Optimal parallel execution implemented
