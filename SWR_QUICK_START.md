# SWR Scraper System - Quick Start Guide

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd backend
npm install bullmq  # Already installed
```

### 2. Start Backend
The SWR system initializes automatically when the backend starts:
```bash
npm start
```

You should see:
```
SWR Scraper Agent initialized { concurrency: 3, jobTypes: ['USER_TRIGGERED_SCRAPE', 'DELTA_REFRESH'] }
```

### 3. Test the System

#### Test Cache Hit (Fresh)
```bash
# First request - will cache
curl "http://localhost:4000/api/products-swr/search?q=iphone"

# Second request - should return cached immediately
curl "http://localhost:4000/api/products-swr/search?q=iphone"
```

Expected response:
```json
{
  "status": "cached",
  "source": "cache",
  "fetchedAt": "2025-11-12T22:00:00.000Z",
  "is_stale": false,
  "data": [...]
}
```

#### Test Cache Miss
```bash
# New query - will return pending status
curl "http://localhost:4000/api/products-swr/search?q=newproduct123"
```

Expected response:
```json
{
  "status": "pending",
  "source": "none",
  "fetchedAt": null,
  "is_stale": true,
  "data": [],
  "message": "Searching... Results will appear shortly."
}
```

## 📡 API Endpoints

### Search Products (SWR)
```
GET /api/products-swr/search?q={query}
GET /api/products-swr/search?q={query}&forceFresh=true
GET /api/products-swr/search?q={query}&connectionId={id}  # For SSE
```

### Get Product (SWR)
```
GET /api/products-swr/{site}/{siteProductId}
GET /api/products-swr/amazon.sa/B08XXX?forceFresh=true
```

## 🔍 Response Status Values

- **`cached`** - Data from cache, fresh
- **`refreshing`** - Data from cache, but stale (background refresh in progress)
- **`pending`** - No cache, scrape job queued
- **`error`** - Error occurred

## ⚙️ Configuration

### Environment Variables
```bash
# Enable/disable SWR agent (default: true)
ENABLE_SWR_AGENT=true

# Cache TTL in seconds (default: 43200 = 12 hours)
CACHE_TTL_SECONDS=43200
```

### Rate Limiting
Configured in `backend/src/agents/scraperAgent.js`:
- Default: 2 requests/second per site
- Max concurrency: 3 concurrent scrapes

## 🧪 Run Tests
```bash
cd backend
npm test tests/swrCache.test.js
npm test tests/scraperAgent.test.js
npm test tests/dbWrite.test.js
```

## 📊 Monitor Queue
```bash
# Check queue stats via admin API
curl http://localhost:4000/admin/scraper/queue
```

## 🎯 Key Features

✅ **Instant Responses** - Cache hits return in <100ms
✅ **Background Updates** - Stale data served while refreshing
✅ **No Blocking** - Users never wait for scrapes
✅ **Scalable** - BullMQ handles high job volumes
✅ **Resilient** - Automatic retries with exponential backoff

## 📚 Documentation

- `SWR_IMPLEMENTATION_SUMMARY.md` - Complete architecture docs
- `SWR_IMPLEMENTATION_COMPLETE.md` - Implementation checklist

## 🔧 Troubleshooting

### Queue Not Processing
- Check Redis connection: `redis-cli ping`
- Check logs for scraper agent initialization
- Verify `ENABLE_SWR_AGENT` is not set to `false`

### Cache Not Working
- Check Redis connection
- Verify cache keys are being set (check Redis: `redis-cli keys "search:*"`)
- Check TTL settings

### Jobs Failing
- Check scraper logs for errors
- Verify scrapers are enabled
- Check rate limiting isn't too aggressive
