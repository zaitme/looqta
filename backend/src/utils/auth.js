/**
 * Authentication utilities
 * Handles password hashing, verification, and session management
 */
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../db/mysql');
const logger = require('./logger');

const SALT_ROUNDS = 12;
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Hash password with salt
 */
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  const hash = await bcrypt.hash(password, salt);
  return { hash, salt };
}

/**
 * Verify password against hash
 */
async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Generate session token
 */
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create session for user
 */
async function createSession(userId, ipAddress, userAgent) {
  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION);
  
  try {
    await db.execute(
      `INSERT INTO admin_sessions (user_id, session_token, ip_address, user_agent, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, sessionToken, ipAddress, userAgent, expiresAt]
    );
    
    return { sessionToken, expiresAt };
  } catch (error) {
    logger.error('Failed to create session', { error: error.message, userId });
    throw error;
  }
}

/**
 * Verify session token
 */
async function verifySession(sessionToken) {
  try {
    const [sessions] = await db.execute(
      `SELECT s.*, u.id as user_id, u.username, u.email, u.role, u.is_active
       FROM admin_sessions s
       JOIN admin_users u ON s.user_id = u.id
       WHERE s.session_token = ? AND s.expires_at > NOW() AND u.is_active = TRUE`,
      [sessionToken]
    );
    
    if (sessions.length === 0) {
      return null;
    }
    
    return sessions[0];
  } catch (error) {
    logger.error('Failed to verify session', { error: error.message });
    return null;
  }
}

/**
 * Delete session
 */
async function deleteSession(sessionToken) {
  try {
    await db.execute(
      `DELETE FROM admin_sessions WHERE session_token = ?`,
      [sessionToken]
    );
  } catch (error) {
    logger.error('Failed to delete session', { error: error.message });
  }
}

/**
 * Delete all sessions for user
 */
async function deleteUserSessions(userId) {
  try {
    await db.execute(
      `DELETE FROM admin_sessions WHERE user_id = ?`,
      [userId]
    );
  } catch (error) {
    logger.error('Failed to delete user sessions', { error: error.message });
  }
}

/**
 * Clean expired sessions
 */
async function cleanExpiredSessions() {
  try {
    // Check database connection first
    try {
      await db.execute('SELECT 1');
    } catch (dbError) {
      logger.debug('Database unavailable, skipping session cleanup', {
        error: dbError.message
      });
      return; // Exit gracefully if DB is unavailable
    }
    
    const [result] = await db.execute(
      `DELETE FROM admin_sessions WHERE expires_at < NOW()`
    );
    logger.debug('Cleaned expired sessions', { count: result.affectedRows });
  } catch (error) {
    logger.error('Failed to clean expired sessions', { 
      error: error.message,
      stack: error.stack 
    });
  }
}

/**
 * Initialize default admin user
 */
async function initializeDefaultAdmin() {
  try {
    // Check database connection first
    try {
      await db.execute('SELECT 1');
    } catch (dbError) {
      logger.warn('Database unavailable, skipping default admin initialization', {
        error: dbError.message
      });
      return; // Exit gracefully if DB is unavailable
    }
    
    const [users] = await db.execute(
      `SELECT id FROM admin_users WHERE username = 'zaitme'`
    );
    
    if (users.length === 0) {
      const { hash, salt } = await hashPassword('highrise');
      await db.execute(
        `INSERT INTO admin_users (username, password_hash, salt, email, full_name, role, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['zaitme', hash, salt, 'admin@looqta.com', 'Default Admin', 'super_admin', true]
      );
      logger.info('Default admin user created', { username: 'zaitme' });
    } else {
      // Update password if it's still placeholder
      const [existing] = await db.execute(
        `SELECT password_hash FROM admin_users WHERE username = 'zaitme'`
      );
      if (existing[0] && existing[0].password_hash === 'PLACEHOLDER_WILL_BE_SET_BY_APP') {
        const { hash, salt } = await hashPassword('highrise');
        await db.execute(
          `UPDATE admin_users SET password_hash = ?, salt = ? WHERE username = 'zaitme'`,
          [hash, salt]
        );
        logger.info('Default admin password updated', { username: 'zaitme' });
      }
    }
  } catch (error) {
    logger.error('Failed to initialize default admin', { 
      error: error.message,
      stack: error.stack 
    });
    // Don't throw - allow app to start even if admin init fails
  }
}

/**
 * Log audit event (non-blocking)
 */
async function logAuditEvent(userId, action, resourceType, resourceId, details, ipAddress, userAgent) {
  try {
    // Check database connection first
    try {
      await db.execute('SELECT 1');
    } catch (dbError) {
      logger.debug('Database unavailable for audit logging', { error: dbError.message });
      return; // Skip logging if DB unavailable
    }
    
    await db.execute(
      `INSERT INTO admin_audit_log (user_id, action, resource_type, resource_id, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, action, resourceType, resourceId, JSON.stringify(details || {}), ipAddress, userAgent]
    );
  } catch (error) {
    // Don't throw - audit logging failures shouldn't break requests
    logger.warn('Failed to log audit event', { 
      error: error.message,
      action,
      resourceType
    });
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  createSession,
  verifySession,
  deleteSession,
  deleteUserSessions,
  cleanExpiredSessions,
  initializeDefaultAdmin,
  logAuditEvent
};
