/**
 * Initialize scraper_configs table and default configurations
 * Run this script to set up the database table
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./src/db/mysql');
const logger = require('./src/utils/logger');

async function initScraperConfigs() {
  try {
    // Create table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS scraper_configs (
        id bigint NOT NULL AUTO_INCREMENT,
        scraper_name varchar(50) NOT NULL,
        display_name varchar(100) NOT NULL,
        enabled tinyint(1) DEFAULT '1',
        timeout_ms int DEFAULT '30000',
        max_retries int DEFAULT '3',
        retry_delay_ms int DEFAULT '1000',
        max_results int DEFAULT '8',
        rate_limit_per_sec decimal(5,2) DEFAULT '2.00',
        concurrency int DEFAULT '1',
        custom_domain varchar(255) DEFAULT NULL,
        user_agent text,
        extra_config json DEFAULT NULL,
        last_modified_by bigint DEFAULT NULL,
        created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY unique_scraper_name (scraper_name),
        KEY idx_enabled (enabled),
        FOREIGN KEY (last_modified_by) REFERENCES admin_users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    
    logger.info('Scraper configs table created/verified');
    
    // Insert default configurations
    const defaults = [
      { scraper_name: 'amazon', display_name: 'Amazon', enabled: 1, timeout_ms: 30000, max_retries: 3, retry_delay_ms: 1000, max_results: 8, rate_limit_per_sec: 2.00, concurrency: 1 },
      { scraper_name: 'noon', display_name: 'Noon', enabled: 1, timeout_ms: 30000, max_retries: 3, retry_delay_ms: 1000, max_results: 1000, rate_limit_per_sec: 2.00, concurrency: 1 },
      { scraper_name: 'jarir', display_name: 'Jarir', enabled: 1, timeout_ms: 30000, max_retries: 3, retry_delay_ms: 1000, max_results: 8, rate_limit_per_sec: 2.00, concurrency: 1 },
      { scraper_name: 'panda', display_name: 'Panda', enabled: 1, timeout_ms: 30000, max_retries: 3, retry_delay_ms: 1000, max_results: 8, rate_limit_per_sec: 2.00, concurrency: 1 },
      { scraper_name: 'extra', display_name: 'Extra', enabled: 1, timeout_ms: 15000, max_retries: 2, retry_delay_ms: 2000, max_results: 8, rate_limit_per_sec: 2.00, concurrency: 1 }
    ];
    
    for (const config of defaults) {
      await db.execute(`
        INSERT INTO scraper_configs 
        (scraper_name, display_name, enabled, timeout_ms, max_retries, retry_delay_ms, max_results, rate_limit_per_sec, concurrency)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          display_name = VALUES(display_name),
          enabled = VALUES(enabled),
          timeout_ms = VALUES(timeout_ms),
          max_retries = VALUES(max_retries),
          retry_delay_ms = VALUES(retry_delay_ms),
          max_results = VALUES(max_results),
          rate_limit_per_sec = VALUES(rate_limit_per_sec),
          concurrency = VALUES(concurrency)
      `, [
        config.scraper_name,
        config.display_name,
        config.enabled,
        config.timeout_ms,
        config.max_retries,
        config.retry_delay_ms,
        config.max_results,
        config.rate_limit_per_sec,
        config.concurrency
      ]);
    }
    
    logger.info('Default scraper configurations initialized');
    console.log('✅ Scraper configurations initialized successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Failed to initialize scraper configs', { error: error.message });
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

initScraperConfigs();
