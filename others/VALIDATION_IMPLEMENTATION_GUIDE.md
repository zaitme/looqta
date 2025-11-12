# Test & Validation Plan Implementation Guide

**Status:** ✅ **FULLY IMPLEMENTED**

---

## Quick Start

### Run All Validations
```bash
cd /opt/looqta/backend
npm run test:all
```

### Run Individual Validations
```bash
npm run test:schema      # Database schema
npm run test:scrapers    # Scraper validation
npm run test:roar        # ROAR admin console
npm run test:performance # Performance baseline
npm run validate         # Quick validation (non-Jest)
```

### Run Jest Tests
```bash
npm test                 # All Jest tests
npm run test:unit        # Unit tests
npm run test:integration # Integration tests
npm run test:feature     # Feature validation tests
```

---

## Validation Scripts

### 1. Schema Validation
**File:** `backend/tests/schema-validation.js`  
**Purpose:** Validates database schema matches migration requirements

**Checks:**
- ✅ All required tables exist
- ✅ Products table columns exist
- ✅ Indexes on price_history
- ✅ Foreign key constraints
- ✅ Critical data types

**Usage:**
```bash
npm run test:schema
```

**Expected Output:**
```
✅ Passed: 36
❌ Failed: 0
⚠️  Warnings: 0
```

---

### 2. Scraper Validation
**File:** `backend/tests/scraper-validation.js`  
**Purpose:** Validates scrapers are working and updating database

**Checks:**
- ✅ Scrapers registered
- ⚠️ Recent scrape data (depends on activity)
- ⚠️ Price history logging (depends on searches)
- ✅ Cache health

**Usage:**
```bash
npm run test:scrapers
```

**Expected Output:**
```
✅ Passed: 6
❌ Failed: 0
⚠️  Warnings: 3 (expected if no recent activity)
```

---

### 3. ROAR Admin Validation
**File:** `backend/tests/roar-admin-validation.js`  
**Purpose:** Validates ROAR admin console functionality

**Checks:**
- ✅ ROAR routes exist
- ⚠️ ROAR tables (warns if not initialized)
- ✅ Login endpoint
- ⚠️ Default admin user (warns if not initialized)

**Usage:**
```bash
npm run test:roar
```

**Note:** If ROAR tables don't exist, run:
```bash
mysql -u looqta_dbuser -p looqta < sql/migrations/2025_add_roar_admin_system.sql
node backend/init-roar-admin.js
```

---

### 4. Performance Baseline
**File:** `backend/tests/performance-baseline.js`  
**Purpose:** Measures API response times and establishes baselines

**Measures:**
- Health check response time
- Cached search response time
- Uncached search response time
- Database query performance
- Redis cache performance

**Usage:**
```bash
npm run test:performance
```

**Targets:**
- Health check: < 300ms
- Cached search: < 300ms
- Uncached search: < 3000ms
- Database query: < 100ms
- Cache query: < 50ms

---

### 5. Master Validation Runner
**File:** `backend/tests/master-validation.js`  
**Purpose:** Runs all validation tests and provides summary

**Usage:**
```bash
npm run test:all
```

**Output:**
- Runs all validation scripts
- Provides comprehensive summary
- Exit code indicates success/failure

---

## Feature Validation Matrix Tests

**File:** `backend/tests/feature-validation.test.js`

**Tests:**
1. ✅ Price Comparison Engine
2. ✅ Price History Tracking
3. ✅ Price Alerts
4. ✅ Product Detail Enrichment
5. ✅ Search Optimization
6. ✅ Affiliate Integration

**Usage:**
```bash
npm run test:feature
```

---

## Integration Tests

**File:** `backend/tests/integration.test.js`

**Tests:**
- API integration
- End-to-end workflows
- Database integration

**Usage:**
```bash
npm run test:integration
```

---

## Folder Cleanup

**File:** `scripts/folder-cleanup.js`

**Purpose:** Moves non-critical files to `/others` directory

**Usage:**
```bash
node scripts/folder-cleanup.js
```

**What it does:**
- Creates `/others` directory structure
- Moves documentation files to `/others`
- Preserves core application files

**Note:** Run this when ready to clean up the repository. It's safe to run multiple times.

---

## Pre-Validation Checklist

Before running validations, ensure:

1. ✅ Environment variables configured (`.env` file)
2. ✅ Database migrations applied
3. ✅ Services can run (PM2 or background)
4. ✅ Backend server running (for performance tests)

---

## Troubleshooting

### Schema Validation Fails
- Check database connection
- Verify migrations applied
- Check table names match

### Scraper Validation Warnings
- Expected if no recent scraper activity
- Run a search to generate data
- Check if services are running

### ROAR Validation Fails
- ROAR tables may not be initialized
- Run migration: `sql/migrations/2025_add_roar_admin_system.sql`
- Run init script: `node backend/init-roar-admin.js`

### Performance Tests Fail
- Backend server must be running
- Check `API_URL` in environment
- Verify services are accessible

---

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Validation Tests
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run validate
```

### Pre-commit Hook
```bash
#!/bin/bash
cd backend
npm run validate
exit $?
```

---

## Success Criteria

✅ All validation scripts run without errors  
✅ Schema validation passes  
✅ Performance baselines established  
✅ Test coverage adequate  
✅ Documentation complete  

---

**Implementation Date:** 2025-11-12  
**Status:** ✅ Complete  
**Ready for:** Production use and CI/CD integration
