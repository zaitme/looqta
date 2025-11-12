/**
 * User-related API routes
 * - Price alerts management
 */
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const db = require('../db/mysql');

/**
 * GET /api/users/:userId/alerts
 * Get all alerts for a user
 */
router.get('/:userId/alerts', async (req, res) => {
  try {
    const userId = req.params.userId;
    const activeOnly = req.query.active !== 'false';
    
    // Check database connection
    try {
      await db.execute('SELECT 1');
    } catch (dbError) {
      logger.error('Database unavailable for user alerts', { error: dbError.message });
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }
    
    const query = activeOnly ?
      `SELECT * FROM user_price_alerts WHERE user_id = ? AND is_active = TRUE ORDER BY created_at DESC` :
      `SELECT * FROM user_price_alerts WHERE user_id = ? ORDER BY created_at DESC`;
    
    const [rows] = await db.execute(query, [userId]);
    res.json({ alerts: rows });
  } catch (error) {
    logger.error('Failed to get user alerts', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve alerts' });
  }
});

module.exports = router;
