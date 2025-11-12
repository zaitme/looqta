/**
 * Authentication middleware for ROAR admin system
 */
const { verifySession, logAuditEvent } = require('../utils/auth');
const logger = require('../utils/logger');

/**
 * Require authentication
 */
async function requireAuth(req, res, next) {
  try {
    const sessionToken = req.cookies?.roar_session || req.headers['x-session-token'];
    
    if (!sessionToken) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    const session = await verifySession(sessionToken);
    
    if (!session) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired session',
        code: 'INVALID_SESSION'
      });
    }
    
    // Attach user info to request
    req.user = {
      id: session.user_id,
      username: session.username,
      email: session.email,
      role: session.role
    };
    req.sessionToken = sessionToken;
    
    next();
  } catch (error) {
    // Check if it's a database connection error
    if (error.message && (error.message.includes('Access denied') || error.message.includes('ECONNREFUSED'))) {
      logger.warn('Database unavailable for auth verification', { error: error.message });
      return res.status(503).json({ 
        success: false, 
        error: 'Service temporarily unavailable',
        code: 'SERVICE_UNAVAILABLE'
      });
    }
    
    logger.error('Auth middleware error', { error: error.message, stack: error.stack });
    res.status(500).json({ 
      success: false, 
      error: 'Authentication error' 
    });
  }
}

/**
 * Require specific role
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }
    
    next();
  };
}

/**
 * Audit log middleware
 */
function auditLog(action, resourceType = null) {
  return async (req, res, next) => {
    // Store original json method
    const originalJson = res.json.bind(res);
    
    // Override json to log after response
    res.json = function(data) {
      // Log audit event (non-blocking - don't fail if logging fails)
      if (req.user) {
        const resourceId = req.params.id || req.body.id || null;
        // Don't await - log asynchronously
        logAuditEvent(
          req.user.id,
          action,
          resourceType,
          resourceId,
          {
            method: req.method,
            path: req.path,
            body: sanitizeAuditData(req.body)
          },
          req.ip,
          req.headers['user-agent']
        ).catch(err => {
          // Don't fail request if audit logging fails
          logger.warn('Audit logging failed', { error: err.message });
        });
      }
      
      return originalJson(data);
    };
    
    next();
  };
}

/**
 * Sanitize audit data (remove sensitive fields)
 */
function sanitizeAuditData(data) {
  if (!data || typeof data !== 'object') return data;
  
  const sensitive = ['password', 'password_hash', 'salt', 'token', 'session_token'];
  const sanitized = { ...data };
  
  for (const key of Object.keys(sanitized)) {
    if (sensitive.includes(key.toLowerCase())) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeAuditData(sanitized[key]);
    }
  }
  
  return sanitized;
}

module.exports = {
  requireAuth,
  requireRole,
  auditLog
};
