/**
 * Redis cache adapter (using ioredis).
 * Configure REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, and REDIS_USER in env.
 */
// Load .env file from parent directory to ensure environment variables are available
require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const Redis = require('ioredis');
const logger = require('../utils/logger');

// Define connection details, prioritizing environment variables
// Note: If Redis uses simple password authentication (not ACLs), don't set username
// Only set username if explicitly provided and not 'default' (which indicates simple auth)
const redisUser = process.env.REDIS_USER;
const redisPassword = process.env.REDIS_PASSWORD;
const useUsername = redisUser && redisUser !== 'default' && redisUser.trim() !== '';
const usePassword = redisPassword && redisPassword.trim() !== '';

const connectionOptions = {
  host: process.env.REDIS_HOST || '192.168.8.74',
  port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
  // Only include username if Redis uses ACLs (not simple password auth)
  ...(useUsername ? { username: redisUser } : {}),
  // Only include password if explicitly set (Redis may not require authentication)
  // If password is set but empty string, don't include it (Redis will use no auth)
  ...(usePassword ? { password: redisPassword } : {}),
  // Recommended options for robust connections
  reconnectOnError: (err) => {
    // Attempt to reconnect on ETIMEDOUT or ECONNRESET
    const targetErrors = ['ETIMEDOUT', 'ECONNRESET', 'EPIPE'];
    return targetErrors.some(target => err.message.includes(target));
  },
  maxRetriesPerRequest: null, // Unlimited retries for commands during connection loss
};

const redis = new Redis(connectionOptions);

// --- Explicit Connection Event Handlers for Debugging ---

redis.on('connect', () => {
  logger.info('Redis connection established', { 
    host: connectionOptions.host, 
    port: connectionOptions.port 
  });
});

redis.on('ready', () => {
  logger.info('Redis client is ready to accept commands');
});

// CRITICAL: Handle the 'error' event to prevent 'Unhandled error event' logs
redis.on('error', (err) => {
  if (err.code === 'EPIPE' || err.code === 'ECONNRESET') {
    // These are often recoverable if the Redis server is configured to timeout idle connections
    // ioredis handles the reconnect automatically
    logger.warn('Redis connection lost, reconnecting', { 
      code: err.code, 
      message: err.message 
    });
  } else if (err.message.includes('NOAUTH')) {
    logger.error('Redis authentication failed', { 
      username: connectionOptions.username,
      message: err.message 
    });
    // You may want to exit the process here if auth is critical
    // process.exit(1);
  } else {
    // Log other errors
    logger.error('Redis client error', { 
      code: err.code,
      message: err.message,
      stack: err.stack 
    });
  }
});

redis.on('reconnecting', (delay) => {
  logger.info('Redis reconnecting', { delay });
});


/**
 * Check if cached data is stale based on fetchedAt timestamp
 * @param {Object} cachedData - Cached data with fetchedAt metadata
 * @param {number} freshnessThresholdMinutes - Threshold in minutes
 * @returns {boolean} True if stale
 */
function isStale(cachedData, freshnessThresholdMinutes) {
  if (!cachedData || !cachedData.fetchedAt) return true;
  const fetchedAt = new Date(cachedData.fetchedAt);
  const now = new Date();
  const ageMinutes = (now - fetchedAt) / (1000 * 60);
  return ageMinutes > freshnessThresholdMinutes;
}

/**
 * Get TTL for a site/product tier
 * @param {string} tier - 'HOT', 'WARM', 'COLD'
 * @returns {number} TTL in seconds
 */
function getTtlForTier(tier) {
  const ttlMap = {
    'HOT': 60 * 60,      // 1 hour
    'WARM': 4 * 60 * 60, // 4 hours
    'COLD': 12 * 60 * 60 // 12 hours
  };
  return ttlMap[tier] || ttlMap['COLD'];
}

/**
 * Get freshness threshold for a site/product tier
 * @param {string} tier - 'HOT', 'WARM', 'COLD'
 * @returns {number} Threshold in minutes
 */
function getFreshnessThresholdForTier(tier) {
  const thresholdMap = {
    'HOT': 30,   // 30 minutes
    'WARM': 120, // 2 hours
    'COLD': 360  // 6 hours
  };
  return thresholdMap[tier] || thresholdMap['COLD'];
}

module.exports = {
  get: async (k) => {
    // We can remove the try/catch here, as ioredis handles command errors and connection loss gracefully.
    // However, keeping it preserves the original pattern and ensures a 'null' return on failure.
    try { 
      return await redis.get(k); 
    } catch(e){ 
      // The explicit redis.on('error') handler above should catch most connection errors, 
      // but this catches command-specific errors.
      logger.error('Redis get failed', { 
        key: k, 
        error: e.message,
        stack: e.stack 
      }); 
      return null; 
    }
  },
  set: async (k, v, ttlSeconds) => {
    try {
      if (ttlSeconds) return await redis.set(k, v, 'EX', Number(ttlSeconds));
      return await redis.set(k, v);
    } catch(e){ 
      logger.error('Redis set failed', { 
        key: k, 
        ttl: ttlSeconds,
        error: e.message,
        stack: e.stack 
      }); 
      throw e; // Re-throw to allow caller to handle
    }
  },
  /**
   * Get cached data with SWR metadata
   * @param {string} key - Cache key
   * @param {number} freshnessThresholdMinutes - Optional freshness threshold
   * @returns {Object|null} { data, source, fetchedAt, is_stale } or null
   */
  getWithMetadata: async (key, freshnessThresholdMinutes = null) => {
    try {
      const cached = await redis.get(key);
      if (!cached) return null;
      
      const parsed = JSON.parse(cached);
      
      // If cached data has metadata, use it
      if (parsed.fetchedAt) {
        const stale = freshnessThresholdMinutes 
          ? isStale(parsed, freshnessThresholdMinutes)
          : (parsed.is_stale || false);
        
        return {
          data: parsed.data || parsed, // Support both new format (with .data) and old format
          source: parsed.source || 'cache',
          fetchedAt: parsed.fetchedAt,
          is_stale: stale
        };
      }
      
      // Legacy format - wrap it
      return {
        data: parsed,
        source: 'cache',
        fetchedAt: new Date().toISOString(), // Unknown, assume now
        is_stale: freshnessThresholdMinutes ? true : false
      };
      
    } catch (e) {
      logger.error('Redis getWithMetadata failed', {
        key,
        error: e.message
      });
      return null;
    }
  },
  /**
   * Set cache with SWR metadata
   * @param {string} key - Cache key
   * @param {*} data - Data to cache
   * @param {number} ttlSeconds - TTL in seconds
   * @param {string} source - Source ('fresh', 'cache', 'scraper')
   */
  setWithMetadata: async (key, data, ttlSeconds, source = 'scraper') => {
    try {
      const payload = {
        source,
        fetchedAt: new Date().toISOString(),
        is_stale: false,
        data: Array.isArray(data) ? data : data
      };
      
      if (ttlSeconds) {
        return await redis.set(key, JSON.stringify(payload), 'EX', Number(ttlSeconds));
      }
      return await redis.set(key, JSON.stringify(payload));
    } catch (e) {
      logger.error('Redis setWithMetadata failed', {
        key,
        error: e.message
      });
      throw e;
    }
  },
  ping: async () => {
    try {
      return await redis.ping();
    } catch(e) {
      logger.error('Redis ping failed', { error: e.message });
      throw e;
    }
  },
  keys: async (pattern) => {
    try {
      return await redis.keys(pattern);
    } catch(e) {
      logger.error('Redis keys failed', { pattern, error: e.message });
      return [];
    }
  },
  del: async (key) => {
    try {
      return await redis.del(key);
    } catch(e) {
      logger.error('Redis del failed', { key, error: e.message });
      throw e;
    }
  },
  ttl: async (key) => {
    try {
      return await redis.ttl(key);
    } catch(e) {
      logger.error('Redis ttl failed', { key, error: e.message });
      return -2; // Key doesn't exist
    }
  },
  setex: async (key, seconds, value) => {
    try {
      return await redis.setex(key, seconds, value);
    } catch(e) {
      logger.error('Redis setex failed', { key, seconds, error: e.message });
      throw e;
    }
  },
  client: redis,
  isStale,
  getTtlForTier,
  getFreshnessThresholdForTier
};
