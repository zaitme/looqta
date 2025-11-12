/**
 * Notification Service - Real-Time Updates
 * PHASE 4: Real-Time Cache Sync & User Notification
 * 
 * Provides WebSocket/SSE support for real-time product updates
 */

const logger = require('../utils/logger');

// Store active connections (in production, use Redis pub/sub)
const connections = new Map();

/**
 * Register a connection for notifications
 * @param {string} connectionId - Unique connection ID
 * @param {Object} connection - Connection object (SSE res or WebSocket)
 * @param {string} type - Connection type ('sse' or 'ws')
 */
function registerConnection(connectionId, connection, type = 'sse') {
  connections.set(connectionId, { connection, type, createdAt: Date.now() });
  logger.debug('Connection registered', { connectionId, type });
}

/**
 * Unregister a connection
 * @param {string} connectionId - Connection ID
 */
function unregisterConnection(connectionId) {
  connections.delete(connectionId);
  logger.debug('Connection unregistered', { connectionId });
}

/**
 * Send notification to a specific connection
 * @param {string} connectionId - Connection ID
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
function notifyConnection(connectionId, event, data) {
  const conn = connections.get(connectionId);
  if (!conn) {
    logger.warn('Connection not found', { connectionId });
    return false;
  }
  
  try {
    if (conn.type === 'sse') {
      // Server-Sent Events
      const res = conn.connection;
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } else if (conn.type === 'ws') {
      // WebSocket
      conn.connection.send(JSON.stringify({ event, data }));
    }
    
    logger.debug('Notification sent', { connectionId, event });
    return true;
  } catch (error) {
    logger.error('Failed to send notification', {
      connectionId,
      event,
      error: error.message,
    });
    // Remove broken connection
    unregisterConnection(connectionId);
    return false;
  }
}

/**
 * Broadcast notification to all connections
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
function broadcast(event, data) {
  let sent = 0;
  const connectionIds = Array.from(connections.keys());
  
  for (const connectionId of connectionIds) {
    if (notifyConnection(connectionId, event, data)) {
      sent++;
    }
  }
  
  logger.debug('Broadcast sent', { event, sent, total: connectionIds.length });
  return sent;
}

/**
 * Notify about product update
 * @param {string} cacheKey - Cache key
 * @param {Object} product - Updated product data
 * @param {string} connectionId - Optional specific connection ID
 */
function notifyProductUpdate(cacheKey, product, connectionId = null) {
  const event = 'updateProduct';
  const data = {
    cacheKey,
    product,
    timestamp: new Date().toISOString(),
  };
  
  if (connectionId) {
    return notifyConnection(connectionId, event, data);
  } else {
    return broadcast(event, data);
  }
}

/**
 * Notify about search results update
 * @param {string} query - Search query
 * @param {Array} results - Updated results
 * @param {string} connectionId - Optional specific connection ID
 */
function notifySearchUpdate(query, results, connectionId = null) {
  const event = 'updateSearch';
  const data = {
    query,
    results,
    count: results.length,
    timestamp: new Date().toISOString(),
  };
  
  if (connectionId) {
    return notifyConnection(connectionId, event, data);
  } else {
    return broadcast(event, data);
  }
}

/**
 * Get connection stats
 * @returns {Object} Connection statistics
 */
function getStats() {
  const stats = {
    total: connections.size,
    byType: {},
  };
  
  for (const [id, conn] of connections.entries()) {
    stats.byType[conn.type] = (stats.byType[conn.type] || 0) + 1;
  }
  
  return stats;
}

module.exports = {
  registerConnection,
  unregisterConnection,
  notifyConnection,
  broadcast,
  notifyProductUpdate,
  notifySearchUpdate,
  getStats,
};
