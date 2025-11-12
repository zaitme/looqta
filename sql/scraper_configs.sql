-- Scraper Configurations Table
-- Stores configuration for each scraper (Amazon, Noon, Jarir, Panda, Extra)

CREATE TABLE IF NOT EXISTS `scraper_configs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `scraper_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `enabled` tinyint(1) DEFAULT '1',
  `timeout_ms` int DEFAULT '30000',
  `max_retries` int DEFAULT '3',
  `retry_delay_ms` int DEFAULT '1000',
  `max_results` int DEFAULT '8',
  `rate_limit_per_sec` decimal(5,2) DEFAULT '2.00',
  `concurrency` int DEFAULT '1',
  `custom_domain` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `extra_config` json DEFAULT NULL,
  `last_modified_by` bigint DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_scraper_name` (`scraper_name`),
  KEY `idx_enabled` (`enabled`),
  FOREIGN KEY (`last_modified_by`) REFERENCES `admin_users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default scraper configurations
INSERT INTO `scraper_configs` (`scraper_name`, `display_name`, `enabled`, `timeout_ms`, `max_retries`, `retry_delay_ms`, `max_results`, `rate_limit_per_sec`, `concurrency`, `custom_domain`) VALUES
('amazon', 'Amazon', 1, 30000, 3, 1000, 8, 2.00, 1, NULL),
('noon', 'Noon', 1, 30000, 3, 1000, 1000, 2.00, 1, NULL),
('jarir', 'Jarir', 1, 30000, 3, 1000, 8, 2.00, 1, NULL),
('panda', 'Panda', 1, 30000, 3, 1000, 8, 2.00, 1, NULL),
('extra', 'Extra', 1, 15000, 2, 2000, 8, 2.00, 1, NULL)
ON DUPLICATE KEY UPDATE `display_name`=VALUES(`display_name`);
