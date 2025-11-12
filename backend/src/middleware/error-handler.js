/**
 * Error handling middleware - prevents information leakage
 */

const logger = require('../utils/logger');

/**
 * Error handler middleware
 */
function errorHandler(err, req, res, next) {
  // Log error with sanitized information
  logger.error('Request error', {
    path: req.path,
    method: req.method,
    ip: req.ip,
    error: err.message,
    // Don't log stack traces in production
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
  
  // Don't leak error details to client
  const statusCode = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'development' 
    ? err.message 
    : 'An error occurred processing your request';
  
  res.status(statusCode).json({
    error: 'Internal server error',
    message: message,
    // Only include request ID in production for tracking
    ...(process.env.NODE_ENV === 'production' && { requestId: req.id })
  });
}

/**
 * 404 handler
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
