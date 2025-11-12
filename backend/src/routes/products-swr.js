/**
 * Products Route with SWR Pattern
 * PHASE 1: Immediate Display & Cache Layer Integration
 * 
 * Uses productController for SWR-based product search and retrieval
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const productController = require('../controllers/productController');
const notificationService = require('../services/notificationService');
const { sanitizeInput } = require('../middleware/security');

/**
 * GET /api/products/search?q=...
 * Search products with SWR pattern
 */
router.get('/search', sanitizeInput, async (req, res) => {
  const q = (req.query.q || req.query.query || '').trim();
  const forceFresh = req.query.forceFresh === 'true' || req.query.fresh === 'true';
  
  if (!q) {
    return res.status(400).json({ 
      status: 'error',
      error: 'query is required' 
    });
  }
  
  if (q.length > 500) {
    return res.status(400).json({ 
      status: 'error',
      error: 'query too long (max 500 characters)' 
    });
  }
  
  try {
    // Generate connection ID for notifications (if client supports SSE)
    const connectionId = req.query.connectionId || null;
    
    const result = await productController.searchProducts(q, {
      forceFresh,
      freshnessThresholdMinutes: 120, // 2 hours for searches
    });
    
    // If pending status, register connection for notifications
    if (result.status === 'pending' && connectionId) {
      notificationService.registerConnection(connectionId, res, 'sse');
      
      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      // Send initial placeholder
      res.write(`data: ${JSON.stringify(result)}\n\n`);
      
      // Keep connection open (will be closed when notification arrives)
      // Connection will be cleaned up by notificationService
    } else {
      // Return JSON response
      res.json(result);
    }
    
  } catch (error) {
    logger.error('Product search failed', {
      query: q,
      error: error.message,
      stack: error.stack,
    });
    
    res.status(500).json({
      status: 'error',
      error: 'Search failed',
      data: [],
    });
  }
});

/**
 * GET /api/products/:site/:siteProductId
 * Get product details with SWR pattern
 */
router.get('/:site/:siteProductId', sanitizeInput, async (req, res) => {
  const { site, siteProductId } = req.params;
  const forceFresh = req.query.forceFresh === 'true';
  const connectionId = req.query.connectionId || null;
  
  try {
    const result = await productController.getProduct(site, siteProductId, {
      forceFresh,
      freshnessThresholdMinutes: 60, // 1 hour for products
    });
    
    // If pending, register for notifications
    if (result.status === 'pending' && connectionId) {
      notificationService.registerConnection(connectionId, res, 'sse');
      
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      res.write(`data: ${JSON.stringify(result)}\n\n`);
    } else {
      res.json(result);
    }
    
  } catch (error) {
    logger.error('Get product failed', {
      site,
      siteProductId,
      error: error.message,
    });
    
    res.status(500).json({
      status: 'error',
      error: 'Failed to get product',
      data: null,
    });
  }
});

module.exports = router;
