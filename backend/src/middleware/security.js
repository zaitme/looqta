/**
 * Security middleware for Looqta backend
 * Implements rate limiting, input sanitization, and security headers
 */

const logger = require('../utils/logger');

// In-memory rate limiting store (use Redis in production)
const rateLimitStore = new Map();

/**
 * Rate limiting middleware
 * Prevents DDoS and brute force attacks
 */
function rateLimiter(options = {}) {
  const {
    windowMs = 60 * 1000, // 1 minute
    maxRequests = 100, // 100 requests per window
    keyGenerator = (req) => req.ip || 'unknown',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();
    
    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance to clean up
      for (const [k, v] of rateLimitStore.entries()) {
        if (now - v.resetTime > windowMs) {
          rateLimitStore.delete(k);
        }
      }
    }

    let record = rateLimitStore.get(key);
    
    if (!record || now > record.resetTime) {
      record = {
        count: 0,
        resetTime: now + windowMs
      };
      rateLimitStore.set(key, record);
    }

    record.count++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count));
    res.setHeader('X-RateLimit-Reset', new Date(record.resetTime).toISOString());

    if (record.count > maxRequests) {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        count: record.count,
        max: maxRequests
      });
      
      return res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMs / 1000} seconds.`,
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
      });
    }

    next();
  };
}

/**
 * Input sanitization middleware
 * Prevents injection attacks (XSS, NoSQL injection, command injection)
 */
function sanitizeInput(req, res, next) {
  // Sanitize query parameters
  if (req.query) {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        req.query[key] = sanitizeString(value);
      }
    }
  }

  // Sanitize body parameters
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize URL parameters
  if (req.params) {
    for (const [key, value] of Object.entries(req.params)) {
      if (typeof value === 'string') {
        req.params[key] = sanitizeString(value);
      }
    }
  }

  next();
}

/**
 * Sanitize a string input
 */
function sanitizeString(input) {
  if (typeof input !== 'string') return input;
  
  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');
  
  // Remove potential script tags and event handlers
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  
  // Remove SQL injection patterns (basic)
  sanitized = sanitized.replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/gi, '');
  
  // Remove command injection patterns
  sanitized = sanitized.replace(/[;&|`$(){}[\]]/g, '');
  
  // Limit length (prevent DoS via extremely long strings)
  const maxLength = 500;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
    logger.warn('Input truncated due to length limit', { originalLength: input.length });
  }
  
  return sanitized.trim();
}

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeString(key);
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  return obj;
}

/**
 * Security headers middleware
 * Adds security headers to prevent common attacks
 */
function securityHeaders(req, res, next) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection (legacy browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Strict Transport Security (if HTTPS)
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Content Security Policy (basic)
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
}

/**
 * Request size limit middleware
 * Prevents DoS via large payloads
 */
function requestSizeLimit(maxSize = 1024 * 1024) { // 1MB default
  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    
    if (contentLength > maxSize) {
      logger.warn('Request too large', {
        ip: req.ip,
        path: req.path,
        size: contentLength,
        max: maxSize
      });
      
      return res.status(413).json({
        error: 'Payload too large',
        message: `Request body exceeds maximum size of ${maxSize} bytes`
      });
    }
    
    next();
  };
}

/**
 * IP whitelist/blacklist middleware (optional)
 */
function ipFilter(options = {}) {
  const { whitelist = [], blacklist = [] } = options;
  
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    
    // Check blacklist first
    if (blacklist.length > 0 && blacklist.includes(ip)) {
      logger.warn('Blocked request from blacklisted IP', { ip, path: req.path });
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check whitelist if configured
    if (whitelist.length > 0 && !whitelist.includes(ip)) {
      logger.warn('Blocked request from non-whitelisted IP', { ip, path: req.path });
      return res.status(403).json({ error: 'Access denied' });
    }
    
    next();
  };
}

/**
 * Log sanitization for security
 * Removes sensitive data from logs
 */
function sanitizeLogData(data) {
  if (!data || typeof data !== 'object') return data;
  
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization', 'cookie'];
  const sanitized = { ...data };
  
  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeLogData(sanitized[key]);
    }
  }
  
  return sanitized;
}

module.exports = {
  rateLimiter,
  sanitizeInput,
  securityHeaders,
  requestSizeLimit,
  ipFilter,
  sanitizeLogData,
  sanitizeString
};
