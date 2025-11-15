/**
 * Public Ads API Route
 * Returns active ad placements for display on frontend
 * No authentication required - public endpoint
 */

const express = require('express');
const router = express.Router();
const db = require('../db/mysql');
const logger = require('../utils/logger');

/**
 * GET /api/ads?position=header|footer|sidebar|inline
 * Get active ad placements for public display
 * Filters by:
 * - is_active = true
 * - Current date is between start_date and end_date (if set)
 * - Optional position filter
 */
router.get('/', async (req, res) => {
  try {
    const { position } = req.query;
    const now = new Date();
    
    // Check database connection first
    let dbAvailable = false;
    try {
      await db.execute('SELECT 1');
      dbAvailable = true;
    } catch (dbError) {
      logger.error('Database unavailable for ads', { error: dbError.message, stack: dbError.stack });
      // Return empty ads array instead of error - allows frontend to work without DB
      return res.status(200).json({ success: true, ads: [] });
    }
    
    if (!dbAvailable) {
      return res.status(200).json({ success: true, ads: [] });
    }
    
    try {
      // Build query - only active ads within date range
      let query = `
        SELECT id, name, position, ad_type, content, image_url, link_url, 
               priority, start_date, end_date, is_active
        FROM ad_placements
        WHERE is_active = 1
          AND (start_date IS NULL OR start_date <= ?)
          AND (end_date IS NULL OR end_date >= ?)
      `;
      
      const params = [now, now];
      
      // Add position filter if provided
      if (position) {
        query += ' AND position = ?';
        params.push(position);
      }
      
      query += ' ORDER BY priority DESC, created_at DESC';
      
      logger.debug('Executing ads query', { 
        position: position || 'all', 
        now: now.toISOString()
      });
      
      const [ads] = await db.execute(query, params);
      
      logger.info('Public ads query result', { 
        count: ads.length, 
        position: position || 'all',
        adIds: ads.map(ad => ad.id)
      });
      
      // Sanitize ads for public display
      // Support Google AdSense: content field can contain HTML/JavaScript ad code
      const sanitizedAds = ads.map(ad => ({
        id: ad.id,
        name: ad.name,
        position: ad.position,
        ad_type: ad.ad_type || 'banner',
        content: ad.content, // Can contain Google AdSense code or HTML
        image_url: ad.image_url,
        link_url: ad.link_url,
        priority: ad.priority || 0
      }));
      
      logger.debug('Public ads fetched successfully', { count: sanitizedAds.length, position: position || 'all' });
      
      res.status(200).json({ success: true, ads: sanitizedAds });
    } catch (queryError) {
      logger.error('Database query failed for ads', { 
        error: queryError.message, 
        stack: queryError.stack,
        position: position || 'all'
      });
      // Return empty array instead of error - graceful degradation
      return res.status(200).json({ success: true, ads: [] });
    }
  } catch (error) {
    logger.error('Failed to get public ads', { 
      error: error.message, 
      stack: error.stack,
      position: req.query.position || 'all'
    });
    // Always return success with empty ads array - never return 500 error
    // This allows frontend to work even when backend has issues
    res.status(200).json({ success: true, ads: [] });
  }
});

module.exports = router;
