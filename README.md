# Looqta (لقطة) — Smart Price Comparison Platform

A modern price comparison platform for the Gulf region, comparing products from Amazon and Noon in real-time.

## 🌟 Features

- **Real-time Price Comparison**: Compare prices from Amazon SA and Noon instantly
- **Parallel Scraping**: Both scrapers run simultaneously for faster results
- **Streaming Results**: See results as soon as each scraper completes
- **Intelligent Caching**: Automatic cache rebuild when new items or price changes detected
- **Background Workers**: Automatic cache refresh for popular queries
- **Modern UI**: High-fidelity design with real-time loading indicators
- **Product Images**: Display product images from both sources
- **Site Badges**: Clear indication of product source (Amazon SA, Noon)
- **ROAR Admin Dashboard**: Complete admin system for managing ads, users, and system settings

## 🚀 Quick Start

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
   cp .env.example .env
   # Edit .env with your Redis and MySQL credentials
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

## 📋 Environment Variables

### Backend (.env)
```bash
# Server
PORT=4000

# Redis Cache
REDIS_HOST=192.168.8.74
REDIS_PORT=6379
REDIS_USER=default
REDIS_PASSWORD=your_password

# MySQL Database (optional but recommended)
DB_HOST=192.168.8.61
DB_PORT=3306
DB_USER=looqta_dbuser
DB_PASSWORD=your_password
DB_NAME=looqta

# Scrapers
AMAZON_DOMAIN=amazon.sa
CACHE_TTL_SECONDS=43200  # 12 hours

# Background Workers
ENABLE_BACKGROUND_REFRESH=true
BACKGROUND_REFRESH_INTERVAL_MINUTES=60
MAX_CONCURRENT_REFRESHES=2
POPULAR_QUERIES=iphone,laptop,headphones

# Chrome/Puppeteer
DEBUG_CHROME=false
PUPPETEER_USER_AGENT=Mozilla/5.0...

# Scrapers
DISABLE_EXTRA_SCRAPER=false  # Set to 'true' to disable Extra scraper (domain may not resolve in all regions)
```

## 🏗️ Architecture

### Backend
- **Express.js** server with RESTful API
- **Puppeteer** for web scraping
- **Redis** for caching
- **MySQL** for data storage (optional)
- **Worker Threads** system for parallel processing
- **Background Workers** for cache refresh

### Frontend
- **Next.js** with App Router
- **React** with hooks
- **Tailwind CSS** for styling
- **Server-Sent Events** for streaming results
- **Real-time UI** with loading indicators

### Proxy-Friendly Architecture
The system uses a proxy-friendly architecture:
- Frontend → Proxy Route (`/api/proxy/*`) → Backend
- Works behind reverse proxies (nginx, Apache, etc.)
- No CORS issues (server-to-server communication)
- Automatic hostname detection for LAN access

## 📡 API Endpoints

### Search
- `GET /api/search?q=<query>` - Standard search (returns all results at once)
- `GET /api/search/stream?q=<query>` - Streaming search (SSE, results appear incrementally)

### Workers Management
- `GET /api/workers/stats` - Get worker statistics
- `POST /api/workers/refresh` - Manually trigger cache refresh
- `POST /api/workers/popular-queries` - Add popular query
- `DELETE /api/workers/popular-queries/:query` - Remove popular query

### Ads (Public)
- `GET /api/ads?position=header|footer|sidebar|inline` - Get active ads for display

### ROAR Admin Dashboard
- `GET /roar/*` - Admin dashboard routes (requires authentication)
- Access via: `http://your-domain:3000/roar`

### Health
- `GET /api/health` - Health check endpoint

## 🎨 UI Features

### Search Page
- **Hero Section**: Gradient header with branding
- **Enhanced Search Box**: Large input with search icon and gradient button
- **Real-time Loading**: Dual-ring spinner with scraper status indicators
- **Scraper Status Cards**: Show progress for each scraper (Amazon, Noon)
- **Streaming Notifications**: Real-time updates as results arrive
- **Ad Placements**: Header and footer ad slots

### Result Cards
- **Product Images**: High-quality images with fallback display
- **Site Badges**: Prominent badges showing source (Amazon SA, Noon)
- **Price Display**: Large, clear pricing with currency
- **Hover Effects**: Smooth animations and transitions
- **Responsive Grid**: 1-4 columns based on screen size
- **Best Deal Indicators**: Visual badges for best, 2nd, and 3rd best deals

### Benefits Section
- **Save Money**: Compare prices from multiple retailers
- **Fast Results**: Real-time price comparisons
- **Trusted Sources**: Amazon and Noon integration

### Demo Searches
- Quick search buttons for popular products
- One-click search functionality

## 🔧 Scrapers

### Amazon Scraper
- **Domain**: `amazon.sa` (configurable via `AMAZON_DOMAIN`)
- **Results**: Up to 8 products per search
- **Features**: 
  - Image extraction (handles lazy loading)
  - Price parsing
  - URL validation (filters sponsored ads)
  - Currency detection (SAR for .sa domain)
  - Multiple selector strategies with fallbacks

### Noon Scraper
- **Domain**: `noon.com/saudi-en` (Saudi Arabia locale)
- **Results**: Up to 8 products per search
- **Features**:
  - Image extraction (API-first, DOM fallback)
  - Price parsing (handles SAR currency)
  - Product card detection
  - Multiple selector strategies
  - API interception for faster results

**Recent Improvements:**
- Fixed image URL extraction (now properly maps `image_url` to `image` for frontend)
- Improved API response parsing
- Better error handling and fallback strategies

## 💾 Caching

### Intelligent Cache Rebuild
The system automatically rebuilds cache when:
- **New items found**: New products discovered
- **Price changes**: Significant price changes (>5%)
- **Items removed**: Products no longer available (>10% removal)

### Cache Strategy
- **TTL**: 12 hours default (configurable)
- **Comparison**: Compares new vs cached results
- **Merging**: Smart merge prioritizing new prices
- **Background Refresh**: Popular queries refreshed automatically

### Cache Format
Results are cached in Redis with:
- Key: `search:{query}`
- Value: JSON array of product results
- TTL: Configurable (default: 43200 seconds = 12 hours)

## 🔄 Background Workers

### Background Refresh Worker
- **Purpose**: Keep popular queries fresh
- **Interval**: 60 minutes (configurable)
- **Concurrent**: Max 2 refreshes at once
- **Popular Queries**: Configurable list (default: iphone, laptop, headphones)

### Worker Thread System
- **Purpose**: True parallelism for CPU-intensive tasks
- **Max Workers**: 4 concurrent workers
- **Timeout**: 2 minutes per worker
- **Note**: Current Puppeteer scrapers use async concurrency (more efficient for I/O-bound tasks)

### Parallel Execution
- **Method**: `Promise.allSettled()` for concurrent async operations
- **Puppeteer**: Launches separate Chrome processes (true parallelism)
- **Performance**: ~40-50% faster than sequential execution

## 📊 Performance

### Parallel Execution
- **Before**: Sequential (~40-50 seconds)
- **After**: Parallel (~15-30 seconds)
- **Improvement**: ~40-50% faster

### Streaming Results
- **First Results**: Appear in ~10-15 seconds
- **All Results**: Complete in ~15-30 seconds
- **User Experience**: Immediate feedback as each scraper completes

## 🐛 Troubleshooting

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

## 📝 Development

### Running Tests
```bash
cd backend
npm test
```

### Code Structure
```
looqta/
├── backend/
│   ├── src/
│   │   ├── scrapers/      # Amazon & Noon scrapers
│   │   ├── routes/         # API routes
│   │   ├── workers/        # Background workers
│   │   ├── utils/          # Utilities (logger, cache utils, validation)
│   │   ├── cache/          # Redis cache adapter
│   │   └── db/             # MySQL database adapter
│   └── logs/               # Application logs
├── frontend/
│   ├── app/                # Next.js app router pages
│   ├── components/         # React components
│   ├── pages/              # Next.js pages (including ROAR admin)
│   └── pages/api/          # Next.js API routes (proxies)
├── sql/                    # Database schema
└── scripts/                # Utility scripts
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

**Frontend:**
- `app/page.js` - Main search page
- `components/SearchBox.js` - Search input component
- `components/ResultCard.js` - Product result card
- `components/AdDisplay.js` - Ad display component
- `pages/roar.js` - ROAR admin dashboard
- `pages/api/proxy/ads.js` - Ads proxy route
- `pages/api/proxy/roar/[...path].js` - ROAR proxy route

## 🔐 ROAR Admin System

### Access
- URL: `http://your-domain:3000/roar`
- Default admin credentials: See `backend/init-roar-admin.js`

### Features
- **Dashboard**: System statistics and overview
- **Ad Management**: Create, edit, delete ad placements
- **User Management**: Manage admin users
- **System Settings**: Configure system parameters
- **Audit Logs**: Track all admin actions

### Proxy Setup
The ROAR system uses proxy routes for seamless operation:
- Frontend calls `/api/proxy/roar/*`
- Proxy forwards to backend `/roar/*`
- Works behind reverse proxies automatically
- No CORS configuration needed

## 🎯 Roadmap

- [ ] Add more e-commerce platforms
- [ ] Implement user accounts and favorites
- [ ] Add price alerts
- [ ] Enhanced filtering and sorting
- [ ] Product reviews aggregation
- [ ] Mobile app
- [ ] Advanced analytics dashboard

## 📄 License

See LICENSE file for details.

## 🤝 Contributing

Contributions welcome! Please ensure:
- Code follows existing style
- Tests pass
- Documentation updated
- No breaking changes

## 📞 Support

For issues or questions:
1. Check troubleshooting section above
2. Review logs in `backend/logs/`
3. Check browser console for frontend errors
4. Verify environment variables are set correctly

---

**Last Updated**: 2025-01-27
**Version**: 0.4.0
