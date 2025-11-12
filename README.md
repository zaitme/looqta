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

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Redis server
- MySQL database (optional)
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

4. **Start Backend**
   ```bash
   cd backend
   npm start
   # Backend runs on http://localhost:4000
   ```

5. **Start Frontend**
   ```bash
   cd frontend
   npm run dev
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

# MySQL Database (optional)
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

## 📡 API Endpoints

### Search
- `GET /api/search?q=<query>` - Standard search (returns all results at once)
- `GET /api/search/stream?q=<query>` - Streaming search (SSE, results appear incrementally)

### Workers Management
- `GET /api/workers/stats` - Get worker statistics
- `POST /api/workers/refresh` - Manually trigger cache refresh
- `POST /api/workers/popular-queries` - Add popular query
- `DELETE /api/workers/popular-queries/:query` - Remove popular query

### Health
- `GET /api/health` - Health check endpoint

## 🎨 UI Features

### Search Page
- **Hero Section**: Gradient header with branding
- **Enhanced Search Box**: Large input with search icon and gradient button
- **Real-time Loading**: Dual-ring spinner with scraper status indicators
- **Scraper Status Cards**: Show progress for each scraper (Amazon, Noon)
- **Streaming Notifications**: Real-time updates as results arrive

### Result Cards
- **Product Images**: High-quality images with fallback display
- **Site Badges**: Prominent badges showing source (Amazon SA, Noon)
- **Price Display**: Large, clear pricing with currency
- **Hover Effects**: Smooth animations and transitions
- **Responsive Grid**: 1-4 columns based on screen size

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
  - Image extraction
  - Price parsing
  - URL validation (filters sponsored ads)
  - Currency detection (SAR for .sa domain)

### Noon Scraper
- **Domain**: `noon.com/saudi-en` (Saudi Arabia locale)
- **Results**: Up to 8 products per search
- **Features**:
  - Image extraction
  - Price parsing (handles SAR currency)
  - Product card detection
  - Multiple selector strategies

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
See `backend/CHROME_DEPS_FIX.md` for details.

### Redis Connection
Ensure Redis is running and accessible:
```bash
redis-cli ping
# Should return: PONG
```

### No Results
- Check scraper logs: `backend/logs/combined.log`
- Verify network connectivity
- Check if target sites are accessible
- Review scraper selectors (sites may have changed structure)

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
│   │   ├── utils/          # Utilities (logger, cache utils)
│   │   └── cache/          # Redis cache adapter
│   └── logs/               # Application logs
├── frontend/
│   ├── app/                # Next.js app router pages
│   ├── components/         # React components
│   └── pages/api/          # Next.js API routes (proxies)
└── sql/                    # Database schema
```

## 📚 Documentation

- `IMPLEMENTATION_SUMMARY.md` - Implementation details
- `backend/SCRAPER_STATUS.md` - Scraper status and fixes
- `backend/THREAD_MANAGEMENT.md` - Parallel execution explanation
- `backend/WORKERS_AND_CACHE.md` - Workers and cache management
- `backend/CHROME_DEPS_FIX.md` - Chrome dependencies troubleshooting

## 🎯 Roadmap

- [ ] Add more e-commerce platforms
- [ ] Implement user accounts and favorites
- [ ] Add price alerts
- [ ] Enhanced filtering and sorting
- [ ] Product reviews aggregation
- [ ] Mobile app

## 📄 License

See LICENSE file for details.

## 🤝 Contributing

Contributions welcome! Please ensure:
- Code follows existing style
- Tests pass
- Documentation updated
- No breaking changes

---

**Last Updated**: 2025-11-10
**Version**: 0.3.0
