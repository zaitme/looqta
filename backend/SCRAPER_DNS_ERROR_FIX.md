# Scraper DNS Error Fix

## Issue
The Extra scraper was failing with `net::ERR_NAME_NOT_RESOLVED` error when trying to access `www.extra.com.sa`. This domain does not resolve (NXDOMAIN), causing the scraper to fail and log errors.

## Solution

### 1. DNS Error Handling
Added graceful DNS error handling to both Extra and Panda scrapers:
- Detects DNS resolution errors (`ERR_NAME_NOT_RESOLVED`, `DNS_PROBE_FINISHED_NXDOMAIN`)
- Logs warnings instead of errors for DNS failures
- Returns empty results gracefully instead of crashing
- Prevents error spam in logs

### 2. Environment Variable Control
Added `DISABLE_EXTRA_SCRAPER` environment variable to completely disable the Extra scraper if needed:
```bash
DISABLE_EXTRA_SCRAPER=true
```

### 3. Scraper Registry Update
Updated scraper registry to conditionally include Extra scraper based on environment variable.

## Changes Made

### `backend/src/scrapers/extra.js`
- Added DNS error detection in navigation try-catch
- Added DNS error detection in main error handler
- Added environment variable check to disable scraper
- Changed DNS errors from `error` level to `warn` level logging

### `backend/src/scrapers/panda.js`
- Added DNS error detection in navigation try-catch
- Added DNS error detection in main error handler
- Changed DNS errors from `error` level to `warn` level logging

### `backend/src/scrapers/scraperRegistry.js`
- Added conditional inclusion of Extra scraper
- Can be disabled via `DISABLE_EXTRA_SCRAPER` environment variable

## Error Handling Pattern

```javascript
try {
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
} catch (navError) {
  // Check for DNS resolution errors
  if (navError.message && (
    navError.message.includes('ERR_NAME_NOT_RESOLVED') ||
    navError.message.includes('net::ERR_NAME_NOT_RESOLVED') ||
    navError.message.includes('DNS_PROBE_FINISHED_NXDOMAIN')
  )) {
    logger.warn('Scraper: Domain not found, skipping scraper', { 
      query, 
      url: searchUrl,
      error: navError.message 
    });
    return [];
  }
  // Re-throw other navigation errors
  throw navError;
}
```

## Usage

### Disable Extra Scraper Completely
Add to `.env` file:
```bash
DISABLE_EXTRA_SCRAPER=true
```

### Result
- No more DNS error spam in logs
- Scrapers gracefully handle unavailable domains
- Other scrapers continue working normally
- System remains stable even when domains are unreachable

## Testing

Tested with:
- ✅ DNS resolution failure handling
- ✅ Other navigation errors still propagate correctly
- ✅ Scraper registry respects environment variable
- ✅ Logs show warnings instead of errors for DNS failures

## Date
2025-11-10
