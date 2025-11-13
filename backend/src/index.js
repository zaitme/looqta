/**
 * Looqta Backend Server
 * Main Express.js application entry point
 * 
 * Features:
 * - RESTful API for product search and comparison
 * - ROAR admin console for system management
 * - Background workers for cache refresh and price alerts
 * - Security middleware (rate limiting, input sanitization, security headers)
 * - Session management and authentication
 * - Comprehensive logging and error handling
 * 
 * @file backend/src/index.js
 * @author Looqta Development Team
 * @version 1.0.0
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const logger = require('./utils/logger');
const app = express();

// Route imports
const searchRouter = require('./routes/search');
const searchStreamRouter = require('./routes/search-stream');
const roarRouter = require('./routes/roar');
const productsRouter = require('./routes/products');
const usersRouter = require('./routes/users');
const affiliateRouter = require('./routes/affiliate');
const adminScraperStatusRouter = require('./routes/admin-scraper-status');
const adsRouter = require('./routes/ads');

// Worker and scheduler imports
const schedule = require('./cron/scheduler');
const deltaScraperScheduler = require('./cron/delta-scraper-scheduler');
const BackgroundRefreshWorker = require('./workers/background-refresh-worker');
const priceAlertWorker = require('./workers/price-alert-worker');

// Utility imports
const { initializeDefaultAdmin, cleanExpiredSessions } = require('./utils/auth');
const { router: workersRouter, setBackgroundWorker } = require('./routes/workers');

// SWR System imports
const scraperAgent = require('./agents/scraperAgent');

// Security middleware imports
const {
  rateLimiter,
  sanitizeInput,
  securityHeaders,
  requestSizeLimit,
  sanitizeLogData
} = require('./middleware/security');

/**
 * Global Error Handlers
 * Catch unhandled promise rejections and exceptions
 */

// Handle unhandled promise rejections
// Prevents application crashes from unhandled async errors
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', sanitizeLogData({ 
    promise, 
    reason: reason?.message || reason,
    stack: reason?.stack
  }));
});

// Handle uncaught exceptions
// Log critical errors and exit gracefully
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', sanitizeLogData({ 
    error: error.message, 
    stack: error.stack 
  }));
  // Exit process to prevent undefined state
  process.exit(1);
});

/**
 * Middleware Configuration
 * Applied in order - security first, then logging, then routes
 */

// Trust proxy setting
// Required when behind reverse proxy (nginx, load balancer) for accurate IP addresses
app.set('trust proxy', 1);

// CORS middleware - allow requests from frontend (including LAN access)
// Allow requests from localhost, server IP, and any IP in the 192.168.x.x range
const allowedOrigins = [
  'http://localhost:3000',
  `http://192.168.8.111:3000`, // Server IP
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [])
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow requests from allowed origins or any 192.168.x.x IP
    if (allowedOrigins.includes(origin) || /^http:\/\/192\.168\.\d+\.\d+:3000$/.test(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for development - restrict in production
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-session-token']
}));

// Security headers middleware
// Adds security headers to all responses (CSP, HSTS, X-Frame-Options, etc.)
app.use(securityHeaders);

// Cookie parser middleware
// Parses cookies from request headers for session management
app.use(cookieParser());

// Request body parsing with size limits
// Parse JSON bodies up to 1MB
app.use(express.json({ limit: '1mb' }));
// Additional request size limit enforcement
app.use(requestSizeLimit(1024 * 1024)); // 1MB

// Input sanitization middleware
// Sanitizes all input to prevent XSS and injection attacks
app.use(sanitizeInput);

// Rate limiting middleware
// Prevents abuse by limiting requests per IP address
// Default: 100 requests per minute per IP
app.use(rateLimiter({
  windowMs: 60 * 1000, // 1 minute window
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  keyGenerator: (req) => req.ip || req.connection.remoteAddress || 'unknown'
}));

// Request logging middleware
// Logs all incoming requests with sanitized data including proxy headers
app.use((req, res, next) => {
  // Extract proxy headers for logging
  const proxyHeaders = {
    ip: req.ip,
    'x-forwarded-for': req.headers['x-forwarded-for'] || null,
    'x-forwarded-proto': req.headers['x-forwarded-proto'] || null,
    'x-forwarded-host': req.headers['x-forwarded-host'] || null,
    'x-real-ip': req.headers['x-real-ip'] || null,
    'x-forwarded-port': req.headers['x-forwarded-port'] || null,
    'user-agent': req.headers['user-agent'] || null
  };
  
  logger.info(`${req.method} ${req.path}`, sanitizeLogData({ 
    query: req.query, 
    ...proxyHeaders
  }));
  next();
});

/**
 * Route Configuration
 * All routes are mounted here
 * Rate limiting and security middleware already applied globally
 */

// Search routes
app.use('/api/search', searchRouter); // Standard search endpoint
app.use('/api/search', searchStreamRouter); // Streaming search endpoint (SSE)

// Worker management routes
app.use('/api/workers', workersRouter);

// ROAR admin console routes
// Comprehensive admin interface for user management, tokens, ads, etc.
app.use('/roar', roarRouter);

// Product routes
app.use('/api/products', productsRouter);

// SWR Product routes (alternative endpoint)
const productsSwrRouter = require('./routes/products-swr');
app.use('/api/products-swr', productsSwrRouter);

// User routes (public API)
app.use('/api/users', usersRouter);

// Public ads routes (for frontend display)
app.use('/api/ads', adsRouter);

// Affiliate routes
app.use('/api/affiliate', affiliateRouter);
app.use('/r', affiliateRouter); // Short affiliate redirect route

// Admin scraper status routes
app.use('/admin/scraper', adminScraperStatusRouter);

/**
 * Health Check Endpoint
 * Simple endpoint to verify server is running
 * No rate limiting applied for monitoring purposes
 */
app.get('/api/health', (req, res) => {
  logger.debug('Health check', { ip: req.ip });
  res.json({ ok: true, ts: new Date() });
});

/**
 * 404 Handler
 * Catches all unmatched routes
 */
app.use((req, res) => {
  logger.warn('404 - Route not found', { 
    path: req.path,
    method: req.method,
    ip: req.ip
  });
  res.status(404).json({ error: 'Not found', path: req.path });
});

/**
 * Global Error Handler
 * Must be last middleware to catch all errors
 */
app.use((err, req, res, next) => {
  logger.error('Unhandled error in route handler', sanitizeLogData({ 
    error: err.message, 
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  }));
  res.status(500).json({ error: 'Internal server error' });
});

/**
 * Background Workers Initialization
 * Initialize workers before starting server
 */

// Background refresh worker
// Automatically refreshes cache for popular queries
const backgroundWorker = new BackgroundRefreshWorker({
  intervalMinutes: parseInt(process.env.BACKGROUND_REFRESH_INTERVAL_MINUTES || '60', 10),
  maxConcurrentRefreshes: parseInt(process.env.MAX_CONCURRENT_REFRESHES || '2', 10),
  popularQueries: process.env.POPULAR_QUERIES ? 
    process.env.POPULAR_QUERIES.split(',').map(q => q.trim()) : 
    ['iphone', 'laptop', 'headphones'] // Default popular queries
});

// Make background worker available to workers router
setBackgroundWorker(backgroundWorker);

/**
 * Server Startup
 * Initialize services and start listening on configured port
 */
const port = parseInt(process.env.PORT || '4000', 10);
const host = process.env.HOST || '0.0.0.0';
app.listen(port, host, async () => {
  logger.info(`🚀 Looqta backend server started`, { 
    port,
    nodeEnv: process.env.NODE_ENV || 'development',
    pid: process.pid
  });
  
  try {
    // Initialize default admin user if it doesn't exist
    logger.info('Initializing default admin user...');
    await initializeDefaultAdmin();
    logger.info('Default admin user initialized');
    
    // Clean expired sessions on startup
    logger.info('Cleaning expired sessions...');
    await cleanExpiredSessions();
    logger.info('Expired sessions cleaned');
    
    // Schedule periodic session cleanup (every hour)
    setInterval(() => {
      cleanExpiredSessions().catch(err => {
        logger.error('Error cleaning expired sessions', { error: err.message });
      });
    }, 60 * 60 * 1000); // 1 hour
    logger.info('Session cleanup scheduled (every hour)');
    
    // Start cron scheduler
    schedule.start();
    logger.info('Cron scheduler started');
    
    // Start delta scraper scheduler (High-Efficiency Scraper)
    // Only starts if not explicitly disabled
    if (process.env.ENABLE_DELTA_SCRAPER !== 'false') {
      deltaScraperScheduler.start();
      logger.info('Delta scraper scheduler started');
    } else {
      logger.info('Delta scraper scheduler disabled via ENABLE_DELTA_SCRAPER=false');
    }
    
    // Start background refresh worker
    // Only starts if not explicitly disabled
    if (process.env.ENABLE_BACKGROUND_REFRESH !== 'false') {
      backgroundWorker.start();
      const stats = backgroundWorker.getStats();
      logger.info('Background refresh worker started', { 
        intervalMinutes: parseInt(process.env.BACKGROUND_REFRESH_INTERVAL_MINUTES || '60', 10),
        maxConcurrent: parseInt(process.env.MAX_CONCURRENT_REFRESHES || '2', 10),
        popularQueries: stats.popularQueries?.length || 0
      });
    } else {
      logger.info('Background refresh worker disabled via ENABLE_BACKGROUND_REFRESH=false');
    }
    
    // Start price alert worker
    // Only starts if not explicitly disabled
    if (process.env.ENABLE_PRICE_ALERTS !== 'false') {
      const alertInterval = parseInt(process.env.PRICE_ALERT_INTERVAL_MINUTES || '15', 10);
      priceAlertWorker.start(alertInterval);
      logger.info('Price alert worker started', { intervalMinutes: alertInterval });
    } else {
      logger.info('Price alert worker disabled via ENABLE_PRICE_ALERTS=false');
    }
    
    // Initialize SWR Scraper Agent
    // Only starts if not explicitly disabled
    if (process.env.ENABLE_SWR_AGENT !== 'false') {
      const worker = scraperAgent.initialize();
      logger.info('SWR Scraper Agent initialized', { 
        concurrency: 3,
        jobTypes: ['USER_TRIGGERED_SCRAPE', 'DELTA_REFRESH']
      });
    } else {
      logger.info('SWR Scraper Agent disabled via ENABLE_SWR_AGENT=false');
    }
    
    logger.info('✅ All services initialized successfully');
  } catch (error) {
    logger.error('Error during server initialization', { 
      error: error.message,
      stack: error.stack
    });
    // Don't exit - server can still handle requests even if some services fail
  }
});

/**
 * Graceful Shutdown Handlers
 * Clean up resources when server receives termination signals
 */

// Handle SIGTERM (termination signal from process manager)
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, initiating graceful shutdown...');
  
  try {
    // Stop all workers and schedulers
    deltaScraperScheduler.stop();
    backgroundWorker.stop();
    priceAlertWorker.stop();
    
    logger.info('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', { error: error.message });
    process.exit(1);
  }
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  logger.info('SIGINT received, initiating graceful shutdown...');
  
  try {
    // Stop all workers and schedulers
    deltaScraperScheduler.stop();
    backgroundWorker.stop();
    priceAlertWorker.stop();
    
    logger.info('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', { error: error.message });
    process.exit(1);
  }
});
