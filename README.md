# Looqta (لقطة) — Smart Price Comparison Platform

**Last Updated**: 2025-11-15  
**Version**: 0.4.0

A modern price comparison platform for the Gulf region, comparing products from Amazon, Noon, Jarir, Extra, and Panda in real-time.

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Environment Configuration](#environment-configuration)
4. [Architecture](#architecture)
5. [API Endpoints](#api-endpoints)
6. [Scrapers](#scrapers)
7. [Caching & Performance](#caching--performance)
8. [Security](#security)
9. [ROAR Admin System](#roar-admin-system)
10. [Ad Management & Google AdSense](#ad-management--google-adsense)
11. [SEO & WhatsApp Sharing](#seo--whatsapp-sharing)
12. [Reverse Proxy Setup](#reverse-proxy-setup)
13. [Troubleshooting](#troubleshooting)
14. [Development Guide](#development-guide)
15. [Missing Features](#missing-features)

---

## Overview

### Features

- **Real-time Price Comparison**: Compare prices from multiple retailers instantly
- **Parallel Scraping**: All scrapers run simultaneously for faster results
- **Streaming Results**: See results as soon as each scraper completes
- **Intelligent Caching**: Automatic cache rebuild when new items or price changes detected
- **Background Workers**: Automatic cache refresh for popular queries
- **Modern UI**: High-fidelity design with real-time loading indicators
- **Product Images**: Display product images from all sources
- **Site Badges**: Clear indication of product source
- **ROAR Admin Dashboard**: Complete admin system for managing ads, users, and system settings
- **Google AdSense Support**: Display Google AdSense ads with proper dimensions
- **SEO Optimization**: Comprehensive SEO with Open Graph, Twitter Cards, and structured data
- **WhatsApp Sharing**: Share products via WhatsApp with formatted messages

---

## Quick Start

### Prerequisites

- Node.js 18+
- Redis server
- MySQL database (optional but recommended)
- Chrome/Chromium browser or Puppeteer bundled Chrome

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd looqta
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   ```

4. **Start Services**

   **Option 1: Using PM2 (Recommended for Production)**
   ```bash
   cd /opt/looqta
   pm2 start ecosystem.config.js
   ```

   **Option 2: Using Start Script**
   ```bash
   cd /opt/looqta
   ./start-all.sh
   ```

   **Option 3: Manual Start**
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm start
   # Backend runs on http://localhost:4000

   # Terminal 2 - Frontend
   cd frontend
   npm run build    # Build first (required for production)
   npm start
   # Frontend runs on http://localhost:3000
   ```

### Verify Services

```bash
# Check Backend
curl http://localhost:4000/api/health
# Should return: {"ok":true,"ts":"..."}

# Check Frontend
curl http://localhost:3000/
# Should return HTML
```

---

## Environment Configuration

### Root `.env` File (Primary Source)

**Location**: `/opt/looqta/.env`

All backend and frontend services load from this root `.env` file:

```bash
# ============================================
# Looqta Application Environment Variables
# Root .env file - used by both backend and frontend
# ============================================

# Backend Server Configuration
PORT=4000
BACKEND_URL=http://127.0.0.1:4000
NODE_ENV=production

# Frontend URL (for CORS and reverse proxy)
FRONTEND_URL=https://looqta.zaitme.com
FRONTEND_URLS=https://looqta.zaitme.com,https://www.looqta.zaitme.com

# Frontend Configuration (Next.js)
# Note: NEXT_PUBLIC_* variables are exposed to the browser
NEXT_PUBLIC_USE_RELATIVE_PATHS=true
NEXT_PUBLIC_SITE_URL=https://looqta.zaitme.com

# MySQL Database Configuration
DB_HOST=192.168.8.61
DB_PORT=3306
DB_USER=looqta_dbuser
DB_PASSWORD=your_password
DB_NAME=looqta

# Redis Cache Configuration
REDIS_HOST=192.168.8.74
REDIS_PORT=6379
REDIS_USER=default
# REDIS_PASSWORD=  # Not required - Redis doesn't use authentication

# Cache Configuration
CACHE_TTL_SECONDS=43200  # 12 hours

# Reverse Proxy Configuration
# Set to 'true' to use relative paths (recommended for nginx/Apache)
USE_RELATIVE_PATHS=true

# Background Workers
ENABLE_BACKGROUND_REFRESH=true
BACKGROUND_REFRESH_INTERVAL_MINUTES=60
MAX_CONCURRENT_REFRESHES=2
POPULAR_QUERIES=iphone,laptop,headphones

# Chrome/Puppeteer
DEBUG_CHROME=false
PUPPETEER_USER_AGENT=Mozilla/5.0...

# Scrapers
DISABLE_EXTRA_SCRAPER=false  # Set to 'true' to disable Extra scraper
AMAZON_DOMAIN=amazon.sa

# SWR System
ENABLE_SWR_AGENT=true
ENABLE_DELTA_SCRAPER=true
ENABLE_PRICE_ALERTS=false

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=100
```

### Environment Variable Loading Priority

**Backend:**
1. Root `.env` file (`/opt/looqta/.env`) - Loaded explicitly via `dotenv.config()`
2. Process environment variables (system/env)

**Frontend (Next.js):**
1. `frontend/.env.local` - Next.js default (for NEXT_PUBLIC_* variables)
2. Root `.env` file - Loaded via `load-env.js` for server-side access
3. Process environment variables

---

## Architecture

### System Architecture

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ HTTP Request
       ▼
┌─────────────────────────────────┐
│   Frontend (Next.js)            │
│   Port: 3000                    │
│   - Handles status flags        │
│   - SSE for real-time updates   │
│   - Proxy routes (/api/proxy/*) │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│   Nginx Reverse Proxy (Optional)│
│   Port: 443/80                  │
│   - SSL/TLS termination         │
│   - Load balancing              │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│   Backend (Express.js)          │
│   Port: 4000                     │
│   - RESTful API                  │
│   - ROAR Admin API               │
│   - Background Workers           │
└──────┬──────────────────────────┘
       │
       ├─── Redis Cache ──────────► Redis (Port 6379)
       │
       ├─── MySQL Database ───────► MySQL (Port 3306)
       │
       └─── Scrapers ─────────────► Amazon, Noon, Jarir, Extra, Panda
```

### Proxy-Friendly Architecture

The system uses a proxy-friendly architecture:
- Frontend → Proxy Route (`/api/proxy/*`) → Backend
- Works behind reverse proxies (nginx, Apache, etc.)
- No CORS issues (server-to-server communication)
- Automatic hostname detection for LAN access

---

## API Endpoints

### Search Endpoints

#### Standard Search
```bash
GET /api/search?q=<query>
```
Returns all results at once.

#### Streaming Search (SSE)
```bash
GET /api/search/stream?q=<query>
```
Streaming search with Server-Sent Events, results appear incrementally.

### Workers Management

```bash
GET /api/workers/stats                    # Get worker statistics
POST /api/workers/refresh                 # Manually trigger cache refresh
POST /api/workers/popular-queries         # Add popular query
DELETE /api/workers/popular-queries/:query # Remove popular query
```

### Ads (Public)

```bash
GET /api/ads?position=header|footer|sidebar|inline
```
Get active ads for display. Supports Google AdSense and custom HTML/JavaScript ads.

### ROAR Admin Dashboard

```bash
GET /roar/*                               # Admin dashboard routes (requires authentication)
POST /roar/auth/login                     # Login endpoint
POST /roar/auth/logout                    # Logout endpoint
```

Access via: `http://your-domain:3000/roar`

### Health Check

```bash
GET /api/health
```
Returns: `{"ok":true,"ts":"..."}`

---

## Scrapers

### Amazon Scraper (amazon.sa)

**Status**: ✅ Working  
**Domain**: `amazon.sa` (Saudi Arabia)  
**Results**: Up to 8 products per search

**Features:**
- Product image extraction (handles lazy loading)
- Price parsing (SAR currency)
- URL validation (filters sponsored ads)
- Multiple selector strategies with fallbacks
- Currency detection (SAR for .sa domain)

### Noon Scraper (noon.com/saudi-en)

**Status**: ✅ Working  
**Domain**: `noon.com/saudi-en` (Saudi Arabia locale)  
**Results**: Up to 8 products per search

**Features:**
- Image extraction (API-first, DOM fallback)
- Price parsing (handles SAR currency)
- Product card detection
- Multiple selector strategies
- API interception for faster results
- Page scrolling for lazy-loaded content

### Jarir Scraper

**Status**: ✅ Working  
**Domain**: `jarir.com`  
**Results**: Up to 8 products per search

### Extra Scraper

**Status**: ⚠️ Conditional  
**Domain**: `extra.com.sa`  
**Note**: Can be disabled via `DISABLE_EXTRA_SCRAPER=true` if domain doesn't resolve in your region

### Panda Scraper

**Status**: ✅ Working  
**Domain**: `panda.sa`  
**Results**: Up to 8 products per search

---

## Caching & Performance

### Intelligent Cache Rebuild

The system automatically rebuilds cache when:
- **New items found**: New products discovered
- **Price changes**: Significant price changes (>5%)
- **Items removed**: Products no longer available (>10% removal)

### Cache Strategy

- **TTL**: 12 hours default (configurable via `CACHE_TTL_SECONDS`)
- **Comparison**: Compares new vs cached results
- **Merging**: Smart merge prioritizing new prices
- **Background Refresh**: Popular queries refreshed automatically

### Cache Format

Results are cached in Redis with:
- Key: `search:{query}`
- Value: JSON array of product results
- TTL: Configurable (default: 43200 seconds = 12 hours)

### Performance Metrics

- **Parallel Execution**: ~40-50% faster than sequential
- **Before**: Sequential (~40-50 seconds)
- **After**: Parallel (~15-30 seconds)
- **First Results**: Appear in ~10-15 seconds
- **All Results**: Complete in ~15-30 seconds
- **Cache Hits**: Return in <100ms

### Background Workers

#### Background Refresh Worker
- **Purpose**: Keep popular queries fresh
- **Interval**: 60 minutes (configurable)
- **Concurrent**: Max 2 refreshes at once
- **Popular Queries**: Configurable list (default: iphone, laptop, headphones)

---

## Security

### Security Features Implemented

#### Critical Priority

1. **Input Sanitization** ✅
   - Removes XSS, SQL injection, command injection patterns
   - Limits input length to 500 characters
   - Applied globally to all routes

2. **Rate Limiting** ✅
   - 100 requests/minute per IP (configurable)
   - Prevents DDoS and brute force attacks
   - Applied globally to all routes
   - Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset

3. **Request Size Limits** ✅
   - 1MB limit for JSON payloads
   - Prevents DoS via large payloads

#### High Priority

4. **Security Headers** ✅
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff
   - X-XSS-Protection: 1; mode=block
   - Content-Security-Policy: Basic CSP
   - Referrer-Policy: strict-origin-when-cross-origin
   - Permissions-Policy: Restricted features

5. **Log Sanitization** ✅
   - Redacts passwords, tokens, secrets from logs
   - Prevents information disclosure
   - Long strings are truncated
   - Nested objects are sanitized recursively

6. **Input Validation** ✅
   - Additional length checks (500 char max)
   - Type validation for request bodies
   - Schema validation for products

---

## ROAR Admin System

### Access

- **URL**: `http://your-domain:3000/roar`
- **Default Admin Credentials**: 
  - Username: `zaitme`
  - Password: `highrise`

### Features

- **Dashboard**: System statistics and overview
- **Ad Management**: Create, edit, delete ad placements with Google AdSense support
- **User Management**: Manage admin users
- **System Settings**: Configure system parameters
- **Audit Logs**: Track all admin actions
- **Cache Management**: View and manage Redis cache keys

### Proxy Setup

The ROAR system uses proxy routes for seamless operation:
- Frontend calls `/api/proxy/roar/*`
- Proxy forwards to backend `/roar/*`
- Works behind reverse proxies automatically
- No CORS configuration needed

### Authentication

- Session-based authentication with secure cookies
- Password hashing using bcrypt (12 rounds)
- Account lockout after failed attempts
- Session expiration management

---

## Ad Management & Google AdSense

### Creating Ads

1. **Access ROAR Admin**: Navigate to `http://your-domain:3000/roar`
2. **Go to Ad Placements**: Click on "Ad Placements" tab
3. **Create New Ad**: Click "+ Create Ad" button
4. **Fill in Details**:
   - **Name**: Descriptive name for the ad
   - **Position**: Select from dropdown (header, footer, sidebar, inline)
   - **Ad Type**: Choose banner, sidebar, inline, etc.
   - **Google AdSense Code**: Paste complete Google AdSense code in the Content field
   - **Active**: Check to enable the ad
   - **Priority**: Higher numbers display first
   - **Date Range**: Optional start/end dates

### Google AdSense Integration

**Supported Features:**
- ✅ Automatic detection of Google AdSense code
- ✅ Script execution for AdSense ads
- ✅ Position-based dimensions:
  - Header/Footer: 728px max-width (standard banner)
  - Sidebar: 300px max-width (standard sidebar)
  - Inline: Full width
- ✅ Responsive ad support (`data-full-width-responsive="true"`)

**How to Add Google AdSense:**

1. Copy your Google AdSense ad code from your AdSense account
2. Paste the complete code (including all `<script>` tags) into the "Google AdSense Code / Custom HTML" field
3. Select the appropriate position
4. Save the ad

**Example Google AdSense Code Format:**
```html
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX"
     crossorigin="anonymous"></script>
<ins class="adsbygoogle"
     style="display:block"
     data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
     data-ad-slot="1234567890"
     data-ad-format="auto"
     data-full-width-responsive="true"></ins>
<script>
     (adsbygoogle = window.adsbygoogle || []).push({});
</script>
```

### Image Ads

- **Image Sizing**: Automatically constrained based on position
  - Header/Footer: Max 120px height
  - Other positions: Max 200px height
- **Responsive**: Images scale properly on all screen sizes
- **Error Handling**: Failed images are hidden gracefully

---

## SEO & WhatsApp Sharing

### SEO Features

**Implemented:**
- ✅ Open Graph tags for social media sharing
- ✅ Twitter Card meta tags
- ✅ WhatsApp-specific meta tags
- ✅ Structured data (JSON-LD) for products and website
- ✅ Canonical URLs
- ✅ Geo-location tags for Saudi Arabia
- ✅ Multilingual support (English/Arabic)
- ✅ robots.txt file
- ✅ sitemap.xml file

**Required Assets (Not Yet Created):**
- ⚠️ Favicon files (favicon.ico, favicon-16x16.png, favicon-32x32.png, apple-touch-icon.png)
- ⚠️ OG image (og-image.jpg - 1200x630 pixels)
- ⚠️ Logo file (logo.png - at least 112x112 pixels)

### WhatsApp Sharing

**Features:**
- ✅ WhatsApp share button on product cards
- ✅ Product-specific share URLs with image and price preview
- ✅ Copy link functionality
- ✅ Formatted share messages with product details

**Share Message Format:**
```
🔍 Found a great deal on Looqta!

📦 [Product Name]
💰 Price: [Price] [Currency]
🛒 Available on: [Site]

Check it out: [Product URL]
```

---

## Reverse Proxy Setup

### Nginx Configuration

**Location**: `/opt/looqta/nginx/looqta.conf`

1. **Install nginx** (if not already installed):
   ```bash
   sudo apt-get update
   sudo apt-get install nginx
   ```

2. **Copy configuration**:
   ```bash
   sudo cp /opt/looqta/nginx/looqta.conf /etc/nginx/sites-available/looqta.conf
   sudo ln -s /etc/nginx/sites-available/looqta.conf /etc/nginx/sites-enabled/
   ```

3. **Update server_name** in config:
   ```nginx
   server_name your-domain.com www.your-domain.com;
   ```

4. **SSL Setup** (Let's Encrypt):
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com -d www.your-domain.com
   ```

5. **Test and reload**:
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

### Configuration Details

**Backend API Routes** (`/api/*`):
- Proxied to `http://127.0.0.1:4000`
- Headers forwarded for reverse proxy support
- WebSocket support included

**ROAR Admin** (`/roar`):
- Proxied to backend
- Cookie forwarding enabled
- Session management works correctly

**Frontend** (`/`):
- Proxied to `http://127.0.0.1:3000` (Next.js)
- All other routes handled by Next.js
- Static files cached

---

## Troubleshooting

### Chrome Dependencies

If you see Chrome library errors:
```bash
cd backend
bash install-chrome-deps.sh
```

Or manually install dependencies:
```bash
# For Debian/Ubuntu
apt-get update
apt-get install -y \
    libnspr4 libnss3 libnssutil3 libsmime3 \
    libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libxkbcommon0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libgbm1 \
    libasound2 libpango-1.0-0 libcairo2 \
    libatspi2.0-0 libxshmfence1

# Or install Chromium which includes all dependencies:
apt-get install -y chromium-browser
```

### Redis Connection

Ensure Redis is running and accessible:
```bash
redis-cli ping
# Should return: PONG
```

### MySQL Connection

If using MySQL, ensure database is accessible:
```bash
mysql -h <DB_HOST> -u <DB_USER> -p
# Enter password and verify connection
```

### Services Not Starting

**Backend not starting?**
1. Check if port 4000 is already in use:
   ```bash
   lsof -i :4000
   ```
2. Check backend logs:
   ```bash
   tail -f /opt/looqta/backend/logs/error.log
   ```
3. Check PM2 status:
   ```bash
   pm2 list
   pm2 logs looqta-backend
   ```

**Frontend not starting?**
1. Check if port 3000 is already in use:
   ```bash
   lsof -i :3000
   ```
2. Make sure you've built the frontend:
   ```bash
   cd /opt/looqta/frontend
   npm run build
   ```
3. Check PM2 status:
   ```bash
   pm2 list
   pm2 logs looqta-frontend
   ```

### No Results

- Check scraper logs: `backend/logs/combined.log`
- Verify network connectivity
- Check if target sites are accessible
- Review scraper selectors (sites may have changed structure)
- Check browser console for frontend errors

### Ads Not Displaying

- Verify ad is marked as `is_active = 1` in database
- Check ad date range (start_date and end_date)
- Verify ad position matches requested position (header/footer/etc.)
- Check browser console for API errors
- Review backend logs for ad query results
- Ensure Google AdSense code is complete (all script tags included)
- Check browser console for script execution errors

### ROAR Login Issues

- Verify backend is running: `curl http://localhost:4000/api/health`
- Check proxy route: `curl http://localhost:3000/api/proxy/roar/auth/login`
- Verify credentials: Username `zaitme`, Password `highrise`
- Check backend logs for authentication errors
- Ensure cookies are enabled in browser
- Check PM2 logs: `pm2 logs looqta-backend`

### CORS Errors

**Solution**: 
- Ensure `FRONTEND_URL` is set correctly in root `.env`
- Check nginx is forwarding `X-Forwarded-Host` header
- Verify backend `trust proxy` is enabled (already done)

### 502 Bad Gateway

**Solution**:
- Check backend is running: `pm2 list`
- Check backend logs: `pm2 logs looqta-backend`
- Verify nginx upstream points to correct port (4000)

### Cookies Not Working

**Solution**:
- Ensure nginx forwards `Cookie` header
- Check `proxy_set_header Cookie $http_cookie;` in nginx config
- Verify `credentials: true` in CORS config (already done)

---

## Development Guide

### Code Structure

```
looqta/
├── backend/
│   ├── src/
│   │   ├── scrapers/          # Amazon, Noon, Jarir, Extra, Panda scrapers
│   │   ├── routes/            # API routes
│   │   ├── workers/           # Background workers
│   │   ├── utils/             # Utilities (logger, cache utils, validation)
│   │   ├── cache/             # Redis cache adapter
│   │   ├── db/                # MySQL database adapter
│   │   └── middleware/        # Security middleware
│   └── logs/                  # Application logs
├── frontend/
│   ├── app/                   # Next.js app router pages
│   ├── components/            # React components
│   ├── pages/                 # Next.js pages (including ROAR admin)
│   ├── pages/api/             # Next.js API routes (proxies)
│   └── utils/                 # Utilities
├── sql/                       # Database schema
├── scripts/                   # Utility scripts
└── nginx/                     # Nginx configuration
```

### Key Components

**Backend:**
- `src/scrapers/noon.js` - Noon scraper (API-first approach)
- `src/scrapers/amazon.js` - Amazon scraper
- `src/routes/search.js` - Standard search endpoint
- `src/routes/search-stream.js` - Streaming search endpoint
- `src/routes/ads.js` - Public ads API
- `src/routes/roar.js` - ROAR admin API
- `src/utils/product-validation.js` - Product validation pipeline
- `src/utils/product-upsert.js` - Database upsert operations
- `src/utils/cache-utils.js` - Cache management utilities
- `src/middleware/security.js` - Security middleware (rate limiting, sanitization)

**Frontend:**
- `app/page.js` - Main search page
- `components/SearchBox.js` - Search input component
- `components/ResultCard.js` - Product result card
- `components/AdDisplay.js` - Ad display component (supports Google AdSense)
- `components/WhatsAppShare.js` - WhatsApp sharing component
- `components/SEOHead.js` - SEO meta tags component
- `pages/roar.js` - ROAR admin dashboard
- `pages/api/proxy/ads.js` - Ads proxy route
- `pages/api/proxy/roar/[...path].js` - ROAR proxy route

### Running Tests

```bash
cd backend
npm test
```

### PM2 Commands

```bash
pm2 list              # View running services
pm2 logs              # View logs
pm2 restart all        # Restart all services
pm2 stop all          # Stop all services
pm2 restart looqta-backend   # Restart just backend
pm2 restart looqta-frontend  # Restart just frontend
pm2 monit             # Monitor services
```

### Logs Location

- Backend logs: `/opt/looqta/backend/logs/`
  - `combined.log` - All logs
  - `error.log` - Error logs only
  - `exceptions.log` - Uncaught exceptions
  - `rejections.log` - Unhandled promise rejections

---

## Missing Features

### Features Missing Since Recovery to Commit bf1134f

After recovering to commit `bf1134f` and cherry-picking only the WhatsApp/SEO commit (`c7f117e`), the following features from intermediate commits are **missing**:

#### 1. Environment Variable Consolidation (Commit: 795099c)
- ❌ **Missing**: `frontend/load-env.js` - Utility to load root .env in frontend
- ❌ **Missing**: Updated `frontend/next.config.js` to use root .env
- ⚠️ **Impact**: Frontend may not load all environment variables correctly

#### 2. Error Log Analysis Report (Commit: 35b6a6a)
- ❌ **Missing**: Comprehensive error log analysis documentation
- ⚠️ **Impact**: No impact on functionality, documentation only

#### 3. BackendUrl.js ES Module Fixes (Commits: 42c72c5, c927a1e)
- ❌ **Missing**: Fixed `backendUrl.js` ES Module conflicts
- ❌ **Missing**: Next.js API routes compatibility improvements
- ⚠️ **Impact**: Potential issues with backend URL detection in API routes

#### 4. Product Upsert Fixes (Commit: c8a8c6e)
- ❌ **Missing**: Fixed product upsert to include required 'site' and 'site_product_id' fields
- ⚠️ **Impact**: Product database operations may fail or be incomplete

#### 5. Reverse Proxy Support Improvements (Commit: e5d0a70)
- ❌ **Missing**: Enhanced reverse proxy configuration
- ❌ **Missing**: Improved CORS configuration for reverse proxy
- ❌ **Missing**: Updated proxy routes to use relative paths
- ⚠️ **Impact**: May have issues when running behind reverse proxy

#### 6. Ad Display Improvements (Commits: a63818e, 1a4a3c3)
- ✅ **Present**: Ad display improvements are already in current codebase
- ✅ **Present**: URL string handling in content field
- ✅ **Present**: Better error handling and fallbacks

#### 7. Loading Spinner for Product Images (Commit: 58f84b2)
- ❌ **Missing**: Dual-ring spinner animation while images load
- ❌ **Missing**: Smooth fade-in transition when image loads
- ⚠️ **Impact**: Images may appear abruptly without loading feedback

### Summary of Missing Features

**Critical Missing Features:**
1. Product upsert fixes (may cause database errors)
2. BackendUrl.js ES Module fixes (may cause API route issues)
3. Reverse proxy support improvements (may cause issues behind nginx)

**Medium Priority Missing Features:**
4. Environment variable consolidation (frontend may not load all env vars)
5. Loading spinner for product images (UX impact)

**Low Priority Missing Features:**
6. Error log analysis report (documentation only)

### Recommendations

1. **Apply Product Upsert Fixes** (High Priority)
   - Fix database operations to include required fields
   - Prevents potential data integrity issues

2. **Apply BackendUrl.js Fixes** (High Priority)
   - Fix ES Module conflicts
   - Ensure API routes work correctly

3. **Apply Reverse Proxy Improvements** (Medium Priority)
   - If running behind nginx/Apache, apply these fixes
   - Improves compatibility with reverse proxies

4. **Add Loading Spinner** (Low Priority)
   - Improves user experience
   - Visual feedback during image loading

---

## Summary

### Environment Files

- **Root `.env`** (`/opt/looqta/.env`) - ✅ PRIMARY SOURCE for all environment variables
- **Frontend `.env.local`** (`/opt/looqta/frontend/.env.local`) - ✅ ACTIVE for Next.js public variables

### Key Features

- ✅ Real-time price comparison from 5 retailers
- ✅ Parallel scraping for fast results
- ✅ Intelligent caching
- ✅ Background workers for cache refresh
- ✅ ROAR admin dashboard
- ✅ Security features (rate limiting, input sanitization, security headers)
- ✅ Reverse proxy support
- ✅ Proxy-friendly architecture
- ✅ Google AdSense ad support
- ✅ SEO optimization
- ✅ WhatsApp sharing

### Performance

- **Cache Hits**: <100ms response time
- **Parallel Scraping**: 40-50% faster than sequential
- **First Results**: 10-15 seconds
- **Complete Results**: 15-30 seconds

---

**For Support**: Check troubleshooting section, review logs in `backend/logs/`, and verify environment variables are set correctly.

**Last Updated**: 2025-11-15  
**Version**: 0.4.0
