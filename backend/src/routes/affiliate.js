/**
 * Affiliate redirect and click tracking
 * GET /r/:token - Redirect to affiliate URL with tracking
 */
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const db = require('../db/mysql');
const crypto = require('crypto');

/**
 * Generate affiliate token from product URL and site
 */
function generateAffiliateToken(url, site) {
  if (!url || !site) return null;
  return crypto.createHash('sha256').update(`${site}:${url}:${Date.now()}`).digest('hex').substring(0, 32);
}

/**
 * Store affiliate token mapping
 * In production, use Redis for this
 */
const tokenCache = new Map();

/**
 * GET /r/:token
 * Redirect to affiliate URL and track click
 * This route is mounted at /r in index.js
 */
router.get('/:token', async (req, res) => {
  try {
    const token = req.params.token;
    const userId = req.query.userId || null;
    
    // Get affiliate URL from token cache or database
    let affiliateData = tokenCache.get(token);
    
    if (!affiliateData) {
      // Try to get from database (if we stored it)
      // For now, we'll need to reconstruct from product data
      // In production, store token->affiliate_url mapping in Redis
      logger.warn('Affiliate token not found', { token });
      return res.status(404).json({ error: 'Invalid affiliate link' });
    }
    
    const { affiliateUrl, productId, productName, site, url } = affiliateData;
    
    if (!affiliateUrl) {
      logger.warn('Affiliate URL missing', { token, productId });
      // Fallback to original URL
      return res.redirect(url || '/');
    }
    
    // Track click (non-blocking - continue even if DB is unavailable)
    try {
      // Check database connection first
      await db.execute('SELECT 1');
      
      await db.execute(
        `INSERT INTO affiliate_clicks 
         (product_id, product_name, site, url, affiliate_url, user_id, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          productId,
          productName,
          site,
          url,
          affiliateUrl,
          userId,
          req.ip,
          req.headers['user-agent'] || null
        ]
      );
    } catch (trackError) {
      // Log but don't fail the redirect
      if (trackError.message && (trackError.message.includes('Access denied') || trackError.message.includes('ECONNREFUSED'))) {
        logger.debug('Database unavailable for affiliate click tracking', { 
          error: trackError.message,
          token 
        });
      } else {
        logger.error('Failed to track affiliate click', { 
          error: trackError.message,
          token 
        });
      }
      // Continue even if tracking fails - redirect should still work
    }
    
    // Redirect to affiliate URL
    res.redirect(affiliateUrl);
  } catch (error) {
    logger.error('Affiliate redirect failed', { 
      error: error.message, 
      stack: error.stack 
    });
    res.status(500).json({ error: 'Redirect failed' });
  }
});

/**
 * POST /api/affiliate/token
 * Generate affiliate token for a product
 */
router.post('/token', async (req, res) => {
  try {
    const { url, site, productId, productName, affiliateUrl } = req.body;
    
    if (!url || !site) {
      return res.status(400).json({ error: 'url and site are required' });
    }
    
    const token = generateAffiliateToken(url, site);
    
    // Store in cache (in production, use Redis with TTL)
    tokenCache.set(token, {
      affiliateUrl: affiliateUrl || url,
      productId,
      productName,
      site,
      url,
      createdAt: Date.now()
    });
    
    res.json({ token, redirectUrl: `/r/${token}` });
  } catch (error) {
    logger.error('Failed to generate affiliate token', { error: error.message });
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

module.exports = router;
