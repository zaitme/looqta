/**
 * MySQL connection helper (mysql2 promise API)
 * Use env DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 */
// Load .env file from parent directory to ensure environment variables are available
require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

// Get configuration from environment variables (required)
if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
  throw new Error('Missing required database environment variables: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME must be set in .env file');
}

const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
  // mysql2 automatically handles caching_sha2_password authentication
};

// Log the actual configuration being used (without password)
logger.info('MySQL pool configuration', {
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  database: dbConfig.database,
  passwordSet: !!dbConfig.password
});

const pool = mysql.createPool(dbConfig);

// Test connection on startup (non-blocking)
pool.getConnection()
  .then(connection => {
    logger.info('MySQL connection established', {
      host: process.env.DB_HOST,
      database: process.env.DB_NAME
    });
    connection.release();
  })
  .catch(err => {
    // Log warning instead of error - app can still run without DB for some features
    logger.warn('MySQL connection failed (app will continue with limited functionality)', {
      error: err.message,
      hint: 'Some features requiring database will be unavailable until connection is restored'
    });
    // Don't throw - allow app to start even if DB is unavailable
  });

// Add error handler for pool errors
pool.on('error', (err) => {
  logger.warn('MySQL pool error', {
    error: err.message,
    code: err.code
  });
  // Don't crash the app on pool errors
});

module.exports = pool;
