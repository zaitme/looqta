/**
 * API endpoints for managing background workers and cache refresh
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// These will be injected by the main app
let backgroundWorker = null;
let workerManager = null;

/**
 * Set the background worker instance (called from index.js)
 */
function setBackgroundWorker(worker) {
  backgroundWorker = worker;
}

/**
 * Set the worker manager instance (called from index.js)
 */
function setWorkerManager(manager) {
  workerManager = manager;
}

/**
 * Get background worker statistics
 */
router.get('/stats', (req, res) => {
  try {
    const stats = {
      backgroundWorker: backgroundWorker ? backgroundWorker.getStats() : null,
      workerManager: workerManager ? workerManager.getStats() : null
    };
    res.json({ success: true, stats });
  } catch (error) {
    logger.error('Error getting worker stats', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Manually trigger background refresh for a query
 */
router.post('/refresh', async (req, res) => {
  try {
    const { query } = req.body;
    
    // Additional validation (input already sanitized by middleware)
    if (!query || typeof query !== 'string') {
      logger.warn('Invalid refresh request', { ip: req.ip, body: req.body });
      return res.status(400).json({ success: false, error: 'Query is required' });
    }
    
    if (query.length > 500) {
      logger.warn('Refresh query too long', { ip: req.ip, length: query.length });
      return res.status(400).json({ success: false, error: 'Query too long (max 500 characters)' });
    }

    if (!backgroundWorker) {
      return res.status(503).json({ success: false, error: 'Background worker not initialized' });
    }

    logger.info('Manual refresh triggered', { query });
    const result = await backgroundWorker.refreshQuery(query);
    res.json({ success: true, result });
  } catch (error) {
    logger.error('Error triggering refresh', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Add a query to popular queries list
 */
router.post('/popular-queries', (req, res) => {
  try {
    const { query } = req.body;
    
    // Additional validation (input already sanitized by middleware)
    if (!query || typeof query !== 'string') {
      logger.warn('Invalid popular query request', { ip: req.ip });
      return res.status(400).json({ success: false, error: 'Query is required' });
    }
    
    if (query.length > 500) {
      logger.warn('Popular query too long', { ip: req.ip, length: query.length });
      return res.status(400).json({ success: false, error: 'Query too long (max 500 characters)' });
    }

    if (!backgroundWorker) {
      return res.status(503).json({ success: false, error: 'Background worker not initialized' });
    }

    backgroundWorker.addPopularQuery(query);
    res.json({ success: true, message: 'Query added to popular queries' });
  } catch (error) {
    logger.error('Error adding popular query', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Remove a query from popular queries list
 */
router.delete('/popular-queries/:query', (req, res) => {
  try {
    const { query } = req.params;
    
    // Additional validation (input already sanitized by middleware)
    if (!query || typeof query !== 'string') {
      logger.warn('Invalid delete popular query request', { ip: req.ip });
      return res.status(400).json({ success: false, error: 'Query is required' });
    }
    
    if (query.length > 500) {
      logger.warn('Delete query too long', { ip: req.ip, length: query.length });
      return res.status(400).json({ success: false, error: 'Query too long (max 500 characters)' });
    }

    if (!backgroundWorker) {
      return res.status(503).json({ success: false, error: 'Background worker not initialized' });
    }

    backgroundWorker.removePopularQuery(query);
    res.json({ success: true, message: 'Query removed from popular queries' });
  } catch (error) {
    logger.error('Error removing popular query', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = {
  router,
  setBackgroundWorker,
  setWorkerManager
};
