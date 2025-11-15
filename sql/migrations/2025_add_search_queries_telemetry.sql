-- Migration: Add search queries telemetry table
-- Purpose: Track search queries for analytics and background job optimization
-- Date: 2025-11-15

CREATE TABLE IF NOT EXISTS `search_queries` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `query` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `query_normalized` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `result_count` int DEFAULT 0,
  `from_cache` tinyint(1) DEFAULT 0,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `response_time_ms` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_query_normalized` (`query_normalized`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_query_created` (`query_normalized`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
