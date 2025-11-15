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
    
    // Check database connection
    try {
      await db.execute('SELECT 1');
    } catch (dbError) {
      logger.error('Database unavailable for ads', { error: dbError.message });
      return res.status(503).json({ success: false, ads: [] });
    }
    
    // First, check total ads count for debugging
    const [allAdsCount] = await db.execute('SELECT COUNT(*) as total FROM ad_placements');
    logger.debug('Total ads in database', { total: allAdsCount[0]?.total || 0 });
    
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
      now: now.toISOString(),
      query: query.substring(0, 200) 
    });
    
    const [ads] = await db.execute(query, params);
    
    logger.info('Public ads query result', { 
      count: ads.length, 
      position: position || 'all',
      ads: ads.map(ad => ({ id: ad.id, name: ad.name, position: ad.position, is_active: ad.is_active }))
    });
    
    // Sanitize ads for public display
    const sanitizedAds = ads.map(ad => ({
      id: ad.id,
      name: ad.name,
      position: ad.position,
      ad_type: ad.ad_type || 'banner',
      content: ad.content,
      image_url: ad.image_url,
      link_url: ad.link_url,
      priority: ad.priority || 0
    }));
    
    logger.debug('Public ads fetched', { count: sanitizedAds.length, position: position || 'all' });
    
    res.json({ success: true, ads: sanitizedAds });
  } catch (error) {
    logger.error('Failed to get public ads', { error: error.message });
    res.status(500).json({ success: false, ads: [] });
  }
});

module.exports = router;
