/**
 * ROAR Admin API routes
 * Comprehensive admin console for user management, API tokens, ad placements, etc.
 */
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const db = require('../db/mysql');
const cache = require('../cache/redis');
const registry = require('../scrapers/scraperRegistry');
const { 
  hashPassword, 
  verifyPassword, 
  createSession, 
  deleteSession,
  deleteUserSessions,
  generateSessionToken
} = require('../utils/auth');
const { requireAuth, requireRole, auditLog } = require('../middleware/auth');
const { sanitizeInput } = require('../middleware/security');
const crypto = require('crypto');

// Apply input sanitization to all routes
router.use(sanitizeInput);

/**
 * GET /roar
 * Health check endpoint for ROAR admin console
 */
router.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'ROAR Admin API is running',
    version: '1.0.0',
    endpoints: {
      auth: '/roar/auth/login',
      users: '/roar/users',
      tokens: '/roar/tokens',
      ads: '/roar/ads',
      stats: '/roar/stats'
    }
  });
});

/**
 * POST /roar/auth/login
 * Authenticate user and create session
 * 
 * Security Features:
 * - Input validation (username/password required)
 * - Database connection check before operations
 * - Timing attack prevention (constant delay for invalid users)
 * - Account lockout after 5 failed attempts (30 minute lock)
 * - Password verification using bcrypt
 * - HTTP-only cookie for session management
 * - Session expiration (24 hours)
 * 
 * @route POST /roar/auth/login
 * @access Public
 * @param {string} username - User's username
 * @param {string} password - User's password
 * @returns {Object} Success response with user data and session token
 * @returns {Object} Error response with error message
 */
router.post('/auth/login', async (req, res) => {
  const startTime = Date.now();
  const { username, password } = req.body;
  
  try {
    // Input validation
    if (!username || !password) {
      logger.warn('Login attempt with missing credentials', { 
        ip: req.ip,
        hasUsername: !!username,
        hasPassword: !!password
      });
      return res.status(400).json({ 
        success: false, 
        error: 'Username and password are required' 
      });
    }
    
    logger.info('Login attempt', { username, ip: req.ip });
    
    // Check database connection before proceeding
    try {
      await db.execute('SELECT 1');
    } catch (dbError) {
      logger.error('Database unavailable for login', { 
        error: dbError.message,
        username,
        ip: req.ip
      });
      return res.status(503).json({ 
        success: false, 
        error: 'Service temporarily unavailable' 
      });
    }
    
    // Retrieve user from database
    // Includes security fields: failed_login_attempts, locked_until, is_active
    const [users] = await db.execute(
      `SELECT id, username, password_hash, salt, email, role, is_active, 
              failed_login_attempts, locked_until, created_at
       FROM admin_users 
       WHERE username = ?`,
      [username]
    );
    
    // Security: Don't reveal if user exists (prevent user enumeration)
    // Use constant delay to prevent timing attacks
    if (users.length === 0) {
      logger.warn('Login attempt with non-existent user', { 
        username,
        ip: req.ip
      });
      // Constant delay to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 1000));
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }
    
    const user = users[0];
    
    // Check if account is locked due to too many failed attempts
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const lockTimeRemaining = Math.ceil((new Date(user.locked_until) - new Date()) / 1000 / 60);
      logger.warn('Login attempt on locked account', { 
        username,
        userId: user.id,
        lockedUntil: user.locked_until,
        ip: req.ip
      });
      return res.status(403).json({ 
        success: false, 
        error: `Account is locked. Please try again in ${lockTimeRemaining} minutes.` 
      });
    }
    
    // Check if account is active/enabled
    if (!user.is_active) {
      logger.warn('Login attempt on disabled account', { 
        username,
        userId: user.id,
        ip: req.ip
      });
      return res.status(403).json({ 
        success: false, 
        error: 'Account is disabled' 
      });
    }
    
    // Verify password using bcrypt
    const isValid = await verifyPassword(password, user.password_hash);
    
    if (!isValid) {
      // Increment failed login attempts
      const failedAttempts = (user.failed_login_attempts || 0) + 1;
      // Lock account after 5 failed attempts for 30 minutes
      const lockedUntil = failedAttempts >= 5 ? 
        new Date(Date.now() + 30 * 60 * 1000) : null;
      
      await db.execute(
        `UPDATE admin_users 
         SET failed_login_attempts = ?, locked_until = ?
         WHERE id = ?`,
        [failedAttempts, lockedUntil, user.id]
      );
      
      logger.warn('Failed login attempt', { 
        username,
        userId: user.id,
        failedAttempts,
        willLock: failedAttempts >= 5,
        ip: req.ip
      });
      
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials',
        remainingAttempts: Math.max(0, 5 - failedAttempts)
      });
    }
    
    // Successful login - reset failed attempts and update last login
    await db.execute(
      `UPDATE admin_users 
       SET failed_login_attempts = 0, locked_until = NULL, last_login = NOW()
       WHERE id = ?`,
      [user.id]
    );
    
    // Create session token
    const { sessionToken, expiresAt } = await createSession(
      user.id,
      req.ip,
      req.headers['user-agent']
    );
    
    // Set HTTP-only cookie for session management
    // Security: httpOnly prevents XSS attacks, secure in production, sameSite prevents CSRF
    res.cookie('roar_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // Changed from 'strict' to 'lax' for cross-origin support
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/' // Ensure cookie is available for all paths
    });
    
    const duration = Date.now() - startTime;
    logger.info('Successful login', { 
      username,
      userId: user.id,
      role: user.role,
      ip: req.ip,
      duration: `${duration}ms`
    });
    
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      sessionToken,
      expiresAt
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Login error', { 
      error: error.message, 
      stack: error.stack,
      username,
      ip: req.ip,
      duration: `${duration}ms`
    });
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

/**
 * POST /roar/auth/logout
 * Logout user and invalidate session
 * 
 * @route POST /roar/auth/logout
 * @access Private (requires authentication)
 * @returns {Object} Success response
 * @returns {Object} Error response
 */
router.post('/auth/logout', requireAuth, async (req, res) => {
  const startTime = Date.now();
  try {
    logger.info('Logout request', { 
      userId: req.user.id,
      username: req.user.username,
      ip: req.ip
    });
    
    // Delete session from database
    await deleteSession(req.sessionToken);
    
    // Clear HTTP-only cookie
    res.clearCookie('roar_session');
    
    const duration = Date.now() - startTime;
    logger.info('Successful logout', { 
      userId: req.user.id,
      username: req.user.username,
      ip: req.ip,
      duration: `${duration}ms`
    });
    
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Logout error', { 
      error: error.message,
      userId: req.user?.id,
      ip: req.ip,
      duration: `${duration}ms`
    });
    res.status(500).json({ success: false, error: 'Logout failed' });
  }
});

/**
 * GET /roar/auth/me
 * Get current authenticated user information
 * 
 * Used by frontend to check authentication status and retrieve user data
 * 
 * @route GET /roar/auth/me
 * @access Private (requires authentication)
 * @returns {Object} Success response with user object
 */
router.get('/auth/me', requireAuth, async (req, res) => {
  try {
    logger.debug('Get current user info', { 
      userId: req.user.id,
      username: req.user.username,
      ip: req.ip
    });
    
    res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    logger.error('Error getting user info', { 
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: 'Failed to retrieve user information' });
  }
});

// ==================== USER MANAGEMENT ====================

/**
 * GET /roar/users
 * Get all admin users
 * 
 * Returns list of all admin users with their details
 * Access restricted to super_admin and admin roles
 * 
 * @route GET /roar/users
 * @access Private (requires super_admin or admin role)
 * @returns {Object} Success response with users array
 * @returns {Object} Error response
 */
router.get('/users', requireAuth, requireRole('super_admin', 'admin'), auditLog('LIST_USERS', 'user'), async (req, res) => {
  const startTime = Date.now();
  try {
    logger.info('Fetching users list', { 
      userId: req.user.id,
      username: req.user.username,
      role: req.user.role,
      ip: req.ip
    });
    
    // Check database connection before query
    try {
      await db.execute('SELECT 1');
    } catch (dbError) {
      logger.error('Database unavailable for user list', { 
        error: dbError.message,
        userId: req.user.id,
        ip: req.ip
      });
      return res.status(503).json({ success: false, error: 'Service temporarily unavailable' });
    }
    
    // Fetch all users (excluding sensitive password fields)
    const [users] = await db.execute(
      `SELECT id, username, email, full_name, role, is_active, last_login, created_at
       FROM admin_users
       ORDER BY created_at DESC`
    );
    
    const duration = Date.now() - startTime;
    logger.info('Users list retrieved', { 
      userId: req.user.id,
      userCount: users.length,
      duration: `${duration}ms`,
      ip: req.ip
    });
    
    res.json({ success: true, users });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Failed to get users', { 
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      duration: `${duration}ms`,
      ip: req.ip
    });
    res.status(500).json({ success: false, error: 'Failed to retrieve users' });
  }
});

/**
 * POST /roar/users
 * Create new user
 */
router.post('/users', requireAuth, requireRole('super_admin'), auditLog('CREATE_USER', 'user'), async (req, res) => {
  try {
    const { username, password, email, full_name, role = 'admin' } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }
    
    // Check database connection
    try {
      await db.execute('SELECT 1');
    } catch (dbError) {
      logger.error('Database unavailable for user creation', { error: dbError.message });
      return res.status(503).json({ success: false, error: 'Service temporarily unavailable' });
    }
    
    // Check if username exists
    const [existing] = await db.execute(
      `SELECT id FROM admin_users WHERE username = ?`,
      [username]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'Username already exists' });
    }
    
    // Hash password
    const { hash, salt } = await hashPassword(password);
    
    // Create user
    const [result] = await db.execute(
      `INSERT INTO admin_users (username, password_hash, salt, email, full_name, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username, hash, salt, email || null, full_name || null, role]
    );
    
    res.json({ 
      success: true, 
      message: 'User created successfully',
      userId: result.insertId 
    });
  } catch (error) {
    logger.error('Failed to create user', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

/**
 * PUT /roar/users/:id
 * Update user
 */
router.put('/users/:id', requireAuth, requireRole('super_admin'), auditLog('UPDATE_USER', 'user'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }
    
    // Check database connection
    try {
      await db.execute('SELECT 1');
    } catch (dbError) {
      logger.error('Database unavailable for user update', { error: dbError.message });
      return res.status(503).json({ success: false, error: 'Service temporarily unavailable' });
    }
    
    const { email, full_name, role, is_active } = req.body;
    
    if (userId === req.user.id && is_active === false) {
      return res.status(400).json({ success: false, error: 'Cannot deactivate your own account' });
    }
    
    const updates = [];
    const values = [];
    
    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }
    if (full_name !== undefined) {
      updates.push('full_name = ?');
      values.push(full_name);
    }
    if (role !== undefined && req.user.role === 'super_admin') {
      updates.push('role = ?');
      values.push(role);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }
    
    values.push(userId);
    
    await db.execute(
      `UPDATE admin_users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    res.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    logger.error('Failed to update user', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

/**
 * POST /roar/users/:id/password
 * Change user password
 */
router.post('/users/:id/password', requireAuth, auditLog('CHANGE_PASSWORD', 'user'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }
    
    // Check database connection
    try {
      await db.execute('SELECT 1');
    } catch (dbError) {
      logger.error('Database unavailable for password change', { error: dbError.message });
      return res.status(503).json({ success: false, error: 'Service temporarily unavailable' });
    }
    
    const { currentPassword, newPassword } = req.body;
    
    // Users can only change their own password unless super_admin
    if (userId !== req.user.id && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }
    
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'New password must be at least 8 characters' });
    }
    
    // If not super_admin, verify current password
    if (req.user.role !== 'super_admin') {
      const [users] = await db.execute(
        `SELECT password_hash FROM admin_users WHERE id = ?`,
        [userId]
      );
      
      if (users.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      
      const isValid = await verifyPassword(currentPassword, users[0].password_hash);
      if (!isValid) {
        return res.status(401).json({ success: false, error: 'Current password is incorrect' });
      }
    }
    
    // Hash new password
    const { hash, salt } = await hashPassword(newPassword);
    
    // Update password
    await db.execute(
      `UPDATE admin_users SET password_hash = ?, salt = ?, failed_login_attempts = 0 WHERE id = ?`,
      [hash, salt, userId]
    );
    
    // Delete all sessions for this user (force re-login)
    await deleteUserSessions(userId);
    
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Failed to change password', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to change password' });
  }
});

/**
 * DELETE /roar/users/:id
 * Delete user
 */
router.delete('/users/:id', requireAuth, requireRole('super_admin'), auditLog('DELETE_USER', 'user'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }
    
    if (userId === req.user.id) {
      return res.status(400).json({ success: false, error: 'Cannot delete your own account' });
    }
    
    // Check database connection
    try {
      await db.execute('SELECT 1');
    } catch (dbError) {
      logger.error('Database unavailable for user deletion', { error: dbError.message });
      return res.status(503).json({ success: false, error: 'Service temporarily unavailable' });
    }
    
    await db.execute(`DELETE FROM admin_users WHERE id = ?`, [userId]);
    
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete user', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
});

// ==================== API TOKEN MANAGEMENT ====================

/**
 * GET /roar/tokens
 * Get all API tokens
 */
router.get('/tokens', requireAuth, auditLog('LIST_TOKENS', 'api_token'), async (req, res) => {
  try {
    // Check database connection
    try {
      await db.execute('SELECT 1');
    } catch (dbError) {
      logger.error('Database unavailable for token list', { error: dbError.message });
      return res.status(503).json({ success: false, error: 'Service temporarily unavailable' });
    }
    
    const [tokens] = await db.execute(
      `SELECT t.id, t.name, t.description, t.permissions, t.last_used_at, 
              t.expires_at, t.is_active, t.created_at, u.username as created_by
       FROM api_tokens t
       LEFT JOIN admin_users u ON t.user_id = u.id
       WHERE t.user_id = ? OR ? = 'super_admin'
       ORDER BY t.created_at DESC`,
      [req.user.id, req.user.role]
    );
    
    // Don't expose full token, only show first 8 chars
    const sanitizedTokens = tokens.map(token => {
      let permissions = null;
      try {
        permissions = token.permissions ? JSON.parse(token.permissions) : null;
      } catch (e) {
        logger.warn('Failed to parse token permissions', { tokenId: token.id });
        permissions = {};
      }
      return {
        ...token,
        token: token.token ? `${token.token.substring(0, 8)}...` : null,
        permissions
      };
    });
    
    res.json({ success: true, tokens: sanitizedTokens });
  } catch (error) {
    logger.error('Failed to get tokens', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to retrieve tokens' });
  }
});

/**
 * POST /roar/tokens
 * Create API token
 */
router.post('/tokens', requireAuth, auditLog('CREATE_TOKEN', 'api_token'), async (req, res) => {
  try {
    const { name, description, permissions, expiresInDays } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Token name is required' });
    }
    
    // Check database connection
    try {
      await db.execute('SELECT 1');
    } catch (dbError) {
      logger.error('Database unavailable for token creation', { error: dbError.message });
      return res.status(503).json({ success: false, error: 'Service temporarily unavailable' });
    }
    
    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Calculate expiration
    const expiresAt = expiresInDays ? 
      new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;
    
    // Create token
    const [result] = await db.execute(
      `INSERT INTO api_tokens (user_id, token, name, description, permissions, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        token,
        name,
        description || null,
        JSON.stringify(permissions || {}),
        expiresAt
      ]
    );
    
    res.json({
      success: true,
      message: 'Token created successfully',
      token: {
        id: result.insertId,
        token, // Only show full token on creation
        name,
        expiresAt
      }
    });
  } catch (error) {
    logger.error('Failed to create token', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to create token' });
  }
});

/**
 * DELETE /roar/tokens/:id
 * Delete API token
 */
router.delete('/tokens/:id', requireAuth, auditLog('DELETE_TOKEN', 'api_token'), async (req, res) => {
  try {
    const tokenId = parseInt(req.params.id);
    
    if (isNaN(tokenId) || tokenId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid token ID' });
    }
    
    // Check database connection
    try {
      await db.execute('SELECT 1');
    } catch (dbError) {
      logger.error('Database unavailable for token deletion', { error: dbError.message });
      return res.status(503).json({ success: false, error: 'Service temporarily unavailable' });
    }
    
    // Check ownership
    const [tokens] = await db.execute(
      `SELECT user_id FROM api_tokens WHERE id = ?`,
      [tokenId]
    );
    
    if (tokens.length === 0) {
      return res.status(404).json({ success: false, error: 'Token not found' });
    }
    
    if (tokens[0].user_id !== req.user.id && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }
    
    await db.execute(`DELETE FROM api_tokens WHERE id = ?`, [tokenId]);
    
    res.json({ success: true, message: 'Token deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete token', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to delete token' });
  }
});

// ==================== AD PLACEMENT MANAGEMENT ====================

/**
 * GET /roar/ads
 * Get all ad placements
 */
router.get('/ads', requireAuth, auditLog('LIST_ADS', 'ad_placement'), async (req, res) => {
  try {
    // Check database connection
    try {
      await db.execute('SELECT 1');
    } catch (dbError) {
      logger.error('Database unavailable for ad list', { error: dbError.message });
      return res.status(503).json({ success: false, error: 'Service temporarily unavailable' });
    }
    
    const [ads] = await db.execute(
      `SELECT a.*, u.username as created_by_name
       FROM ad_placements a
       LEFT JOIN admin_users u ON a.created_by = u.id
       ORDER BY a.priority DESC, a.created_at DESC`
    );
    
    const sanitizedAds = ads.map(ad => {
      let targetAudience = null;
      try {
        targetAudience = ad.target_audience ? JSON.parse(ad.target_audience) : null;
      } catch (e) {
        logger.warn('Failed to parse ad target_audience', { adId: ad.id });
        targetAudience = {};
      }
      return {
        ...ad,
        target_audience: targetAudience
      };
    });
    
    res.json({ success: true, ads: sanitizedAds });
  } catch (error) {
    logger.error('Failed to get ads', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to retrieve ads' });
  }
});

/**
 * POST /roar/ads
 * Create ad placement
 */
router.post('/ads', requireAuth, auditLog('CREATE_AD', 'ad_placement'), async (req, res) => {
  try {
    const { name, position, ad_type, content, image_url, link_url, target_audience, start_date, end_date, priority } = req.body;
    
    if (!name || !position) {
      return res.status(400).json({ success: false, error: 'Name and position are required' });
    }
    
    // Check database connection
    try {
      await db.execute('SELECT 1');
    } catch (dbError) {
      logger.error('Database unavailable for ad creation', { error: dbError.message });
      return res.status(503).json({ success: false, error: 'Service temporarily unavailable' });
    }
    
    const [result] = await db.execute(
      `INSERT INTO ad_placements 
       (name, position, ad_type, content, image_url, link_url, target_audience, start_date, end_date, priority, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        position,
        ad_type || 'banner',
        content || null,
        image_url || null,
        link_url || null,
        JSON.stringify(target_audience || {}),
        start_date || null,
        end_date || null,
        priority || 0,
        req.user.id
      ]
    );
    
    res.json({ 
      success: true, 
      message: 'Ad placement created successfully',
      adId: result.insertId 
    });
  } catch (error) {
    logger.error('Failed to create ad', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to create ad' });
  }
});

/**
 * PUT /roar/ads/:id
 * Update ad placement
 */
router.put('/ads/:id', requireAuth, auditLog('UPDATE_AD', 'ad_placement'), async (req, res) => {
  try {
    const adId = parseInt(req.params.id);
    
    if (isNaN(adId) || adId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid ad ID' });
    }
    
    // Check database connection
    try {
      await db.execute('SELECT 1');
    } catch (dbError) {
      logger.error('Database unavailable for ad update', { error: dbError.message });
      return res.status(503).json({ success: false, error: 'Service temporarily unavailable' });
    }
    
    const updates = [];
    const values = [];
    
    const allowedFields = ['name', 'position', 'ad_type', 'content', 'image_url', 'link_url', 'target_audience', 'start_date', 'end_date', 'is_active', 'priority'];
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'target_audience') {
          updates.push(`${field} = ?`);
          values.push(JSON.stringify(req.body[field]));
        } else {
          updates.push(`${field} = ?`);
          values.push(req.body[field]);
        }
      }
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }
    
    values.push(adId);
    
    await db.execute(
      `UPDATE ad_placements SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    res.json({ success: true, message: 'Ad placement updated successfully' });
  } catch (error) {
    logger.error('Failed to update ad', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to update ad' });
  }
});

/**
 * DELETE /roar/ads/:id
 * Delete ad placement
 */
router.delete('/ads/:id', requireAuth, auditLog('DELETE_AD', 'ad_placement'), async (req, res) => {
  try {
    const adId = parseInt(req.params.id);
    
    if (isNaN(adId) || adId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid ad ID' });
    }
    
    // Check database connection
    try {
      await db.execute('SELECT 1');
    } catch (dbError) {
      logger.error('Database unavailable for ad deletion', { error: dbError.message });
      return res.status(503).json({ success: false, error: 'Service temporarily unavailable' });
    }
    
    await db.execute(`DELETE FROM ad_placements WHERE id = ?`, [adId]);
    res.json({ success: true, message: 'Ad placement deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete ad', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to delete ad' });
  }
});

// ==================== SYSTEM MANAGEMENT ====================

/**
 * GET /roar/scrapers
 * Get all scraper configurations with full details
 */
router.get('/scrapers', requireAuth, async (req, res) => {
  try {
    // Try to load from database first
    let configs = [];
    try {
      await db.execute('SELECT 1');
      [configs] = await db.execute(`
        SELECT sc.*, au.username as last_modified_by_username
        FROM scraper_configs sc
        LEFT JOIN admin_users au ON sc.last_modified_by = au.id
        ORDER BY sc.scraper_name
      `);
    } catch (dbError) {
      logger.warn('Database unavailable, using in-memory settings', { error: dbError.message });
      // Fallback to in-memory settings
      const settings = registry.getScraperSettings();
      const scraperNames = ['amazon', 'noon', 'jarir', 'panda', 'extra'];
      const displayNames = {
        amazon: 'Amazon',
        noon: 'Noon',
        jarir: 'Jarir',
        panda: 'Panda',
        extra: 'Extra'
      };
      
      configs = scraperNames.map(name => ({
        scraper_name: name,
        display_name: displayNames[name],
        enabled: settings[name]?.enabled !== false ? 1 : 0,
        timeout_ms: settings[name]?.timeout_ms || 30000,
        max_retries: settings[name]?.max_retries || 3,
        retry_delay_ms: settings[name]?.retry_delay_ms || 1000,
        max_results: settings[name]?.max_results || 8,
        rate_limit_per_sec: settings[name]?.rate_limit_per_sec || 2.00,
        concurrency: settings[name]?.concurrency || 1,
        custom_domain: settings[name]?.custom_domain || null,
        user_agent: settings[name]?.user_agent || null,
        extra_config: settings[name]?.extra_config || null
      }));
    }
    
    const scrapers = configs.map(config => ({
      id: config.id,
      name: config.scraper_name,
      displayName: config.display_name,
      enabled: config.enabled === 1,
      timeoutMs: config.timeout_ms,
      maxRetries: config.max_retries,
      retryDelayMs: config.retry_delay_ms,
      maxResults: config.max_results,
      rateLimitPerSec: parseFloat(config.rate_limit_per_sec),
      concurrency: config.concurrency,
      customDomain: config.custom_domain,
      userAgent: config.user_agent,
      extraConfig: config.extra_config ? (typeof config.extra_config === 'string' ? JSON.parse(config.extra_config) : config.extra_config) : null,
      lastModifiedBy: config.last_modified_by_username,
      updatedAt: config.updated_at
    }));
    
    res.json({ success: true, scrapers });
  } catch (error) {
    logger.error('Failed to get scrapers', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /roar/scrapers/:name
 * Get specific scraper configuration
 */
router.get('/scrapers/:name', requireAuth, async (req, res) => {
  try {
    const { name } = req.params;
    
    if (!['amazon', 'noon', 'jarir', 'panda', 'extra'].includes(name)) {
      return res.status(400).json({ success: false, error: 'Invalid scraper name' });
    }
    
    let config;
    try {
      await db.execute('SELECT 1');
      const [configs] = await db.execute(
        'SELECT * FROM scraper_configs WHERE scraper_name = ?',
        [name]
      );
      
      if (configs.length === 0) {
        // Return default config if not in database
        const settings = registry.getScraperSettings();
        const defaultConfig = settings[name] || { enabled: false };
        config = {
          scraper_name: name,
          display_name: name.charAt(0).toUpperCase() + name.slice(1),
          enabled: defaultConfig.enabled ? 1 : 0,
          timeout_ms: defaultConfig.timeout_ms || 30000,
          max_retries: defaultConfig.max_retries || 3,
          retry_delay_ms: defaultConfig.retry_delay_ms || 1000,
          max_results: defaultConfig.max_results || 8,
          rate_limit_per_sec: defaultConfig.rate_limit_per_sec || 2.00,
          concurrency: defaultConfig.concurrency || 1,
          custom_domain: defaultConfig.custom_domain || null,
          user_agent: defaultConfig.user_agent || null,
          extra_config: defaultConfig.extra_config || null
        };
      } else {
        config = configs[0];
      }
    } catch (dbError) {
      logger.warn('Database unavailable, using in-memory settings', { error: dbError.message });
      const settings = registry.getScraperSettings();
      const defaultConfig = settings[name] || { enabled: false };
      config = {
        scraper_name: name,
        display_name: name.charAt(0).toUpperCase() + name.slice(1),
        enabled: defaultConfig.enabled ? 1 : 0,
        timeout_ms: defaultConfig.timeout_ms || 30000,
        max_retries: defaultConfig.max_retries || 3,
        retry_delay_ms: defaultConfig.retry_delay_ms || 1000,
        max_results: defaultConfig.max_results || 8,
        rate_limit_per_sec: defaultConfig.rate_limit_per_sec || 2.00,
        concurrency: defaultConfig.concurrency || 1,
        custom_domain: defaultConfig.custom_domain || null,
        user_agent: defaultConfig.user_agent || null,
        extra_config: defaultConfig.extra_config || null
      };
    }
    
    res.json({
      success: true,
      scraper: {
        id: config.id,
        name: config.scraper_name,
        displayName: config.display_name,
        enabled: config.enabled === 1,
        timeoutMs: config.timeout_ms,
        maxRetries: config.max_retries,
        retryDelayMs: config.retry_delay_ms,
        maxResults: config.max_results,
        rateLimitPerSec: parseFloat(config.rate_limit_per_sec),
        concurrency: config.concurrency,
        customDomain: config.custom_domain,
        userAgent: config.user_agent,
        extraConfig: config.extra_config ? (typeof config.extra_config === 'string' ? JSON.parse(config.extra_config) : config.extra_config) : null,
        updatedAt: config.updated_at
      }
    });
  } catch (error) {
    logger.error('Failed to get scraper', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /roar/scrapers/:name
 * Update specific scraper configuration
 */
router.put('/scrapers/:name', requireAuth, requireRole('super_admin', 'admin'), auditLog('UPDATE_SCRAPER', 'scraper'), async (req, res) => {
  try {
    const { name } = req.params;
    const {
      enabled,
      timeoutMs,
      maxRetries,
      retryDelayMs,
      maxResults,
      rateLimitPerSec,
      concurrency,
      customDomain,
      userAgent,
      extraConfig
    } = req.body;
    
    if (!['amazon', 'noon', 'jarir', 'panda', 'extra'].includes(name)) {
      return res.status(400).json({ success: false, error: 'Invalid scraper name' });
    }
    
    // Validate inputs
    if (enabled !== undefined && typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'enabled must be boolean' });
    }
    if (timeoutMs !== undefined && (typeof timeoutMs !== 'number' || timeoutMs < 1000)) {
      return res.status(400).json({ success: false, error: 'timeoutMs must be >= 1000' });
    }
    if (maxRetries !== undefined && (typeof maxRetries !== 'number' || maxRetries < 0 || maxRetries > 10)) {
      return res.status(400).json({ success: false, error: 'maxRetries must be between 0 and 10' });
    }
    if (maxResults !== undefined && (typeof maxResults !== 'number' || maxResults < 1 || maxResults > 10000)) {
      return res.status(400).json({ success: false, error: 'maxResults must be between 1 and 10000' });
    }
    if (rateLimitPerSec !== undefined && (typeof rateLimitPerSec !== 'number' || rateLimitPerSec < 0.1 || rateLimitPerSec > 100)) {
      return res.status(400).json({ success: false, error: 'rateLimitPerSec must be between 0.1 and 100' });
    }
    if (concurrency !== undefined && (typeof concurrency !== 'number' || concurrency < 1 || concurrency > 10)) {
      return res.status(400).json({ success: false, error: 'concurrency must be between 1 and 10' });
    }
    
    try {
      await db.execute('SELECT 1');
      
      // Check if config exists
      const [existing] = await db.execute(
        'SELECT id FROM scraper_configs WHERE scraper_name = ?',
        [name]
      );
      
      const extraConfigJson = extraConfig ? JSON.stringify(extraConfig) : null;
      
      if (existing.length > 0) {
        // Update existing
        await db.execute(
          `UPDATE scraper_configs SET
            enabled = COALESCE(?, enabled),
            timeout_ms = COALESCE(?, timeout_ms),
            max_retries = COALESCE(?, max_retries),
            retry_delay_ms = COALESCE(?, retry_delay_ms),
            max_results = COALESCE(?, max_results),
            rate_limit_per_sec = COALESCE(?, rate_limit_per_sec),
            concurrency = COALESCE(?, concurrency),
            custom_domain = ?,
            user_agent = ?,
            extra_config = ?,
            last_modified_by = ?
          WHERE scraper_name = ?`,
          [
            enabled !== undefined ? (enabled ? 1 : 0) : null,
            timeoutMs || null,
            maxRetries || null,
            retryDelayMs || null,
            maxResults || null,
            rateLimitPerSec || null,
            concurrency || null,
            customDomain || null,
            userAgent || null,
            extraConfigJson,
            req.user.id,
            name
          ]
        );
      } else {
        // Insert new
        const displayNames = {
          amazon: 'Amazon',
          noon: 'Noon',
          jarir: 'Jarir',
          panda: 'Panda',
          extra: 'Extra'
        };
        
        await db.execute(
          `INSERT INTO scraper_configs 
          (scraper_name, display_name, enabled, timeout_ms, max_retries, retry_delay_ms, max_results, rate_limit_per_sec, concurrency, custom_domain, user_agent, extra_config, last_modified_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            name,
            displayNames[name] || name,
            enabled !== undefined ? (enabled ? 1 : 0) : 1,
            timeoutMs || 30000,
            maxRetries || 3,
            retryDelayMs || 1000,
            maxResults || 8,
            rateLimitPerSec || 2.00,
            concurrency || 1,
            customDomain || null,
            userAgent || null,
            extraConfigJson,
            req.user.id
          ]
        );
      }
      
      // Reload settings from database
      await registry.loadScraperSettings();
      
      // Get updated config
      const [updated] = await db.execute(
        'SELECT * FROM scraper_configs WHERE scraper_name = ?',
        [name]
      );
      
      res.json({
        success: true,
        scraper: {
          name: updated[0].scraper_name,
          displayName: updated[0].display_name,
          enabled: updated[0].enabled === 1,
          timeoutMs: updated[0].timeout_ms,
          maxRetries: updated[0].max_retries,
          retryDelayMs: updated[0].retry_delay_ms,
          maxResults: updated[0].max_results,
          rateLimitPerSec: parseFloat(updated[0].rate_limit_per_sec),
          concurrency: updated[0].concurrency,
          customDomain: updated[0].custom_domain,
          userAgent: updated[0].user_agent,
          extraConfig: updated[0].extra_config ? JSON.parse(updated[0].extra_config) : null,
          updatedAt: updated[0].updated_at
        }
      });
    } catch (dbError) {
      logger.warn('Database unavailable, updating in-memory only', { error: dbError.message });
      // Fallback to in-memory update
      const settings = {};
      settings[name] = {
        enabled: enabled !== undefined ? enabled : registry.getScraperSettings()[name]?.enabled !== false,
        timeout_ms: timeoutMs || registry.getScraperSettings()[name]?.timeout_ms || 30000,
        max_retries: maxRetries !== undefined ? maxRetries : registry.getScraperSettings()[name]?.max_retries || 3,
        retry_delay_ms: retryDelayMs || registry.getScraperSettings()[name]?.retry_delay_ms || 1000,
        max_results: maxResults || registry.getScraperSettings()[name]?.max_results || 8,
        rate_limit_per_sec: rateLimitPerSec || registry.getScraperSettings()[name]?.rate_limit_per_sec || 2.00,
        concurrency: concurrency || registry.getScraperSettings()[name]?.concurrency || 1,
        custom_domain: customDomain !== undefined ? customDomain : registry.getScraperSettings()[name]?.custom_domain,
        user_agent: userAgent !== undefined ? userAgent : registry.getScraperSettings()[name]?.user_agent,
        extra_config: extraConfig !== undefined ? extraConfig : registry.getScraperSettings()[name]?.extra_config
      };
      
      registry.updateScraperSettings(settings);
      res.json({ success: true, scrapers: registry.getScraperSettings() });
    }
  } catch (error) {
    logger.error('Failed to update scraper', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /roar/scrapers (legacy - for backward compatibility)
 * Update multiple scraper settings (enable/disable only)
 */
router.post('/scrapers', requireAuth, requireRole('super_admin', 'admin'), auditLog('UPDATE_SCRAPERS', 'scraper'), async (req, res) => {
  try {
    const { scrapers } = req.body;
    
    if (!scrapers || typeof scrapers !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid scrapers data' });
    }
    
    try {
      await db.execute('SELECT 1');
      
      // Update enabled status for each scraper
      for (const [scraperName, enabled] of Object.entries(scrapers)) {
        if (['amazon', 'noon', 'jarir', 'panda', 'extra'].includes(scraperName)) {
          await db.execute(
            'UPDATE scraper_configs SET enabled = ?, last_modified_by = ? WHERE scraper_name = ?',
            [enabled === true ? 1 : 0, req.user.id, scraperName]
          );
        }
      }
      
      // Reload settings
      await registry.loadScraperSettings();
    } catch (dbError) {
      logger.warn('Database unavailable, updating in-memory only', { error: dbError.message });
      const settings = {};
      Object.keys(scrapers).forEach(scraperName => {
        if (['amazon', 'noon', 'jarir', 'panda', 'extra'].includes(scraperName)) {
          settings[scraperName] = { enabled: scrapers[scraperName] === true };
        }
      });
      registry.updateScraperSettings(settings);
    }
    
    const updatedSettings = registry.getScraperSettings();
    res.json({ success: true, scrapers: updatedSettings });
  } catch (error) {
    logger.error('Failed to update scrapers', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /roar/cache/stats
 * Get cache statistics
 */
router.get('/cache/stats', requireAuth, async (req, res) => {
  try {
    let connected = false;
    try {
      await cache.ping();
      connected = true;
    } catch (e) {
      connected = false;
    }
    
    const keys = connected ? await cache.keys('search:*') : [];
    
    res.json({ 
      success: true, 
      cache: {
        connected,
        keyCount: keys?.length || 0
      }
    });
  } catch (error) {
    logger.error('Failed to get cache stats', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /roar/cache/keys
 * List all cache keys (with optional pattern filter)
 */
router.get('/cache/keys', requireAuth, requireRole('super_admin', 'admin'), async (req, res) => {
  try {
    const pattern = req.query.pattern || '*';
    
    let connected = false;
    try {
      await cache.ping();
      connected = true;
    } catch (e) {
      connected = false;
    }
    
    if (!connected) {
      return res.json({ success: true, keys: [], connected: false });
    }
    
    const keys = await cache.keys(pattern);
    
    // Get TTL and value preview for each key
    const keysWithInfo = await Promise.all(keys.map(async (key) => {
      try {
        const ttl = await cache.ttl(key);
        const value = await cache.get(key);
        let valuePreview = null;
        let valueType = 'string';
        
        if (value) {
          try {
            const parsed = JSON.parse(value);
            valueType = Array.isArray(parsed) ? 'array' : typeof parsed;
            if (typeof parsed === 'object') {
              valuePreview = Array.isArray(parsed) 
                ? `Array(${parsed.length} items)`
                : `Object(${Object.keys(parsed).length} keys)`;
            } else {
              valuePreview = String(value).substring(0, 100);
            }
          } catch (e) {
            valuePreview = String(value).substring(0, 100);
          }
        }
        
        return {
          key,
          ttl: ttl > 0 ? ttl : null, // -1 means no expiration, -2 means key doesn't exist
          valuePreview,
          valueType,
          size: value ? Buffer.byteLength(value, 'utf8') : 0
        };
      } catch (e) {
        return {
          key,
          ttl: null,
          valuePreview: 'Error reading',
          valueType: 'unknown',
          size: 0
        };
      }
    }));
    
    res.json({ success: true, keys: keysWithInfo, connected: true, pattern });
  } catch (error) {
    logger.error('Failed to get cache keys', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /roar/cache/key/:key
 * Get specific cache key value
 */
router.get('/cache/key/:key', requireAuth, requireRole('super_admin', 'admin'), async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    
    let connected = false;
    try {
      await cache.ping();
      connected = true;
    } catch (e) {
      connected = false;
    }
    
    if (!connected) {
      return res.status(503).json({ success: false, error: 'Cache not connected' });
    }
    
    const value = await cache.get(key);
    const ttl = await cache.ttl(key);
    
    if (value === null) {
      return res.status(404).json({ success: false, error: 'Key not found' });
    }
    
    let parsedValue = value;
    let valueType = 'string';
    try {
      parsedValue = JSON.parse(value);
      valueType = Array.isArray(parsedValue) ? 'array' : typeof parsedValue;
    } catch (e) {
      // Not JSON, keep as string
    }
    
    res.json({
      success: true,
      key,
      value: parsedValue,
      valueType,
      ttl: ttl > 0 ? ttl : null,
      size: Buffer.byteLength(value, 'utf8')
    });
  } catch (error) {
    logger.error('Failed to get cache key', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /roar/cache/key
 * Set a cache key
 */
router.post('/cache/key', requireAuth, requireRole('super_admin', 'admin'), auditLog('SET_CACHE_KEY', 'cache'), async (req, res) => {
  try {
    const { key, value, ttl } = req.body;
    
    if (!key) {
      return res.status(400).json({ success: false, error: 'Key is required' });
    }
    
    if (value === undefined || value === null) {
      return res.status(400).json({ success: false, error: 'Value is required' });
    }
    
    let connected = false;
    try {
      await cache.ping();
      connected = true;
    } catch (e) {
      connected = false;
    }
    
    if (!connected) {
      return res.status(503).json({ success: false, error: 'Cache not connected' });
    }
    
    // Serialize value to JSON if it's an object or array
    const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
    
    if (ttl && ttl > 0) {
      await cache.setex(key, ttl, serializedValue);
    } else {
      await cache.set(key, serializedValue);
    }
    
    res.json({ success: true, message: 'Cache key set successfully', key });
  } catch (error) {
    logger.error('Failed to set cache key', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /roar/cache/key/:key
 * Update a cache key value and/or TTL
 */
router.put('/cache/key/:key', requireAuth, requireRole('super_admin', 'admin'), auditLog('UPDATE_CACHE_KEY', 'cache'), async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const { value, ttl } = req.body;
    
    let connected = false;
    try {
      await cache.ping();
      connected = true;
    } catch (e) {
      connected = false;
    }
    
    if (!connected) {
      return res.status(503).json({ success: false, error: 'Cache not connected' });
    }
    
    // Check if key exists
    const exists = await cache.exists(key);
    if (!exists) {
      return res.status(404).json({ success: false, error: 'Key not found' });
    }
    
    // If value is provided, update it
    if (value !== undefined && value !== null) {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (ttl && ttl > 0) {
        // Update value and TTL
        await cache.setex(key, ttl, serializedValue);
      } else {
        // Update value, preserve existing TTL by getting current TTL first
        const currentTtl = await cache.ttl(key);
        if (currentTtl > 0) {
          // Key has TTL, set value and restore TTL
          await cache.set(key, serializedValue);
          await cache.expire(key, currentTtl);
        } else {
          // No TTL, just set value
          await cache.set(key, serializedValue);
        }
      }
    } else if (ttl && ttl > 0) {
      // Only update TTL, preserve value
      await cache.expire(key, ttl);
    } else {
      return res.status(400).json({ success: false, error: 'Either value or ttl must be provided' });
    }
    
    res.json({ success: true, message: 'Cache key updated successfully', key });
  } catch (error) {
    logger.error('Failed to update cache key', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /roar/cache/key/:key
 * Delete a specific cache key
 */
router.delete('/cache/key/:key', requireAuth, requireRole('super_admin', 'admin'), auditLog('DELETE_CACHE_KEY', 'cache'), async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    
    let connected = false;
    try {
      await cache.ping();
      connected = true;
    } catch (e) {
      connected = false;
    }
    
    if (!connected) {
      return res.status(503).json({ success: false, error: 'Cache not connected' });
    }
    
    const deleted = await cache.del(key);
    
    if (deleted === 0) {
      return res.status(404).json({ success: false, error: 'Key not found' });
    }
    
    res.json({ success: true, message: 'Cache key deleted successfully', key });
  } catch (error) {
    logger.error('Failed to delete cache key', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /roar/cache/clear
 * Clear cache
 */
router.post('/cache/clear', requireAuth, requireRole('super_admin', 'admin'), auditLog('CLEAR_CACHE', 'cache'), async (req, res) => {
  try {
    const { pattern } = req.body;
    
    const searchPattern = pattern || 'search:*';
    const keys = await cache.keys(searchPattern);
    
    if (keys && keys.length > 0) {
      await Promise.all(keys.map(key => cache.del(key)));
      res.json({ success: true, message: `Cleared ${keys.length} cache entries`, pattern: searchPattern });
    } else {
      res.json({ success: true, message: 'No cache entries found', pattern: searchPattern });
    }
  } catch (error) {
    logger.error('Failed to clear cache', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /roar/stats
 * Get system statistics
 */
router.get('/stats', requireAuth, async (req, res) => {
  try {
    // Check database connection
    let dbAvailable = true;
    try {
      await db.execute('SELECT 1');
    } catch (dbError) {
      dbAvailable = false;
      logger.warn('Database unavailable for stats', { error: dbError.message });
    }
    
    let stats = {
      users: 0,
      apiTokens: 0,
      activeAds: 0,
      priceHistoryEntries: 0,
      activeAlerts: 0,
      totalScrapers: 5,
      enabledScrapers: 0
    };
    
    if (dbAvailable) {
      try {
        const [userCount] = await db.execute(`SELECT COUNT(*) as count FROM admin_users`);
        const [tokenCount] = await db.execute(`SELECT COUNT(*) as count FROM api_tokens WHERE is_active = TRUE`);
        const [adCount] = await db.execute(`SELECT COUNT(*) as count FROM ad_placements WHERE is_active = TRUE`);
        const [priceHistoryCount] = await db.execute(`SELECT COUNT(*) as count FROM price_history`);
        const [alertCount] = await db.execute(`SELECT COUNT(*) as count FROM user_price_alerts WHERE is_active = TRUE`);
        
        stats = {
          users: userCount[0]?.count || 0,
          apiTokens: tokenCount[0]?.count || 0,
          activeAds: adCount[0]?.count || 0,
          priceHistoryEntries: priceHistoryCount[0]?.count || 0,
          activeAlerts: alertCount[0]?.count || 0,
          totalScrapers: 5,
          enabledScrapers: 0
        };
      } catch (dbError) {
        logger.warn('Failed to fetch some stats from database', { error: dbError.message });
      }
    }
    
    const settings = registry.getScraperSettings();
    const activeScrapers = registry.getActiveScrapers();
    stats.enabledScrapers = activeScrapers.length;
    
    res.json({
      success: true,
      stats,
      dbAvailable
    });
  } catch (error) {
    logger.error('Failed to get stats', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /roar/audit-log
 * Get audit log
 */
router.get('/audit-log', requireAuth, requireRole('super_admin', 'admin'), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000); // Max 1000
    const offset = Math.max(parseInt(req.query.offset) || 0, 0); // Min 0
    
    // Check database connection
    try {
      await db.execute('SELECT 1');
    } catch (dbError) {
      logger.error('Database unavailable for audit log', { error: dbError.message });
      return res.status(503).json({ success: false, error: 'Service temporarily unavailable' });
    }
    
    const [logs] = await db.execute(
      `SELECT a.*, u.username
       FROM admin_audit_log a
       LEFT JOIN admin_users u ON a.user_id = u.id
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    
    const sanitizedLogs = logs.map(log => {
      let details = null;
      try {
        details = log.details ? JSON.parse(log.details) : null;
      } catch (e) {
        logger.warn('Failed to parse audit log details', { logId: log.id });
        details = {};
      }
      return {
        ...log,
        details
      };
    });
    
    res.json({ success: true, logs: sanitizedLogs });
  } catch (error) {
    logger.error('Failed to get audit log', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
