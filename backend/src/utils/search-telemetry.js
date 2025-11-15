/**
 * Search Query Telemetry
 * Tracks search queries for analytics and background job optimization
 */

const db = require('../db/mysql');
const logger = require('./logger');

/**
 * Track a search query (non-blocking)
 * @param {string} query - Search query
 * @param {number} resultCount - Number of results returned
 * @param {boolean} fromCache - Whether results came from cache
 * @param {string} ipAddress - User IP address
 * @param {string} userAgent - User agent string
 * @param {number} responseTimeMs - Response time in milliseconds
 */
async function trackSearchQuery(query, resultCount = 0, fromCache = false, ipAddress = null, userAgent = null, responseTimeMs = null) {
  if (!query || query.trim().length === 0) {
    return;
  }

  // Non-blocking - don't wait for DB operation
  (async () => {
    try {
      // Check database connection first
      await db.execute('SELECT 1');
    } catch (dbError) {
      logger.debug('Search telemetry: Database unavailable, skipping', {
        error: dbError.message
      });
      return; // Exit gracefully if DB is unavailable
    }

    try {
      const normalizedQuery = query.toLowerCase().trim();
      
      await db.execute(
        `INSERT INTO search_queries 
         (query, query_normalized, result_count, from_cache, ip_address, user_agent, response_time_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          query.substring(0, 500), // Limit to 500 chars
          normalizedQuery.substring(0, 500),
          resultCount,
          fromCache ? 1 : 0,
          ipAddress,
          userAgent,
          responseTimeMs
        ]
      );
      
      logger.debug('Search query tracked', { query: normalizedQuery, resultCount, fromCache });
    } catch (error) {
      // Don't fail the search if telemetry fails
      if (error.message && (error.message.includes('Access denied') || error.message.includes('ECONNREFUSED'))) {
        logger.debug('Search telemetry: Database connection error, skipping', {
          error: error.message
        });
        return;
      }
      logger.warn('Failed to track search query', {
        error: error.message,
        query: query.substring(0, 100)
      });
    }
  })();
}

/**
 * Get search analytics
 * @param {number} days - Number of days to analyze
 * @returns {Promise<Object>} Search analytics data
 */
async function getSearchAnalytics(days = 30) {
  try {
    await db.execute('SELECT 1');
  } catch (dbError) {
    logger.error('Database unavailable for search analytics', { error: dbError.message });
    throw new Error('Database unavailable');
  }

  // Top searched keywords
  const [topKeywords] = await db.execute(
    `SELECT 
       query_normalized as keyword,
       COUNT(*) as search_count,
       AVG(result_count) as avg_results,
       SUM(CASE WHEN from_cache = 1 THEN 1 ELSE 0 END) as cache_hits,
       MAX(created_at) as last_searched
     FROM search_queries
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY query_normalized
     ORDER BY search_count DESC
     LIMIT 50`,
    [days]
  );

  // Searches by day
  const [searchesByDay] = await db.execute(
    `SELECT 
       DATE(created_at) as date,
       COUNT(*) as search_count,
       COUNT(DISTINCT query_normalized) as unique_queries,
       AVG(result_count) as avg_results,
       SUM(CASE WHEN from_cache = 1 THEN 1 ELSE 0 END) as cache_hits
     FROM search_queries
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY DATE(created_at)
     ORDER BY date DESC`,
    [days]
  );

  // Total statistics
  const [totalStats] = await db.execute(
    `SELECT 
       COUNT(*) as total_searches,
       COUNT(DISTINCT query_normalized) as unique_queries,
       AVG(result_count) as avg_results,
       SUM(CASE WHEN from_cache = 1 THEN 1 ELSE 0 END) as cache_hits,
       AVG(response_time_ms) as avg_response_time
     FROM search_queries
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [days]
  );

  // Today's statistics
  const [todayStats] = await db.execute(
    `SELECT 
       COUNT(*) as total_searches,
       COUNT(DISTINCT query_normalized) as unique_queries
     FROM search_queries
     WHERE DATE(created_at) = CURDATE()`
  );

  // This week's statistics
  const [weekStats] = await db.execute(
    `SELECT 
       COUNT(*) as total_searches,
       COUNT(DISTINCT query_normalized) as unique_queries
     FROM search_queries
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
  );

  return {
    summary: {
      totalSearches: totalStats[0]?.total_searches || 0,
      uniqueQueries: totalStats[0]?.unique_queries || 0,
      avgResults: parseFloat(totalStats[0]?.avg_results || 0).toFixed(2),
      cacheHits: totalStats[0]?.cache_hits || 0,
      avgResponseTime: parseFloat(totalStats[0]?.avg_response_time || 0).toFixed(0),
      todaySearches: todayStats[0]?.total_searches || 0,
      todayUniqueQueries: todayStats[0]?.unique_queries || 0,
      weekSearches: weekStats[0]?.total_searches || 0,
      weekUniqueQueries: weekStats[0]?.unique_queries || 0
    },
    topKeywords: topKeywords,
    searchesByDay: searchesByDay
  };
}

module.exports = {
  trackSearchQuery,
  getSearchAnalytics
};
