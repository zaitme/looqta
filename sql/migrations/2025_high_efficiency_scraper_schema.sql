-- Migration: High-Efficiency Scraper Schema Updates
-- Date: 2025-11-12
-- Purpose: Add is_valid flag, site_product_id, product_metrics table, and unique constraints

USE looqta;

-- Add is_valid flag to products table (default FALSE - must pass validation pipeline)
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS is_valid BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS site_product_id VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS price_amount DECIMAL(12,2) NULL,
  ADD COLUMN IF NOT EXISTS price_currency VARCHAR(8) DEFAULT 'SAR',
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS trust_score INT DEFAULT 0;

-- Create unique composite index on (site, site_product_id) for ON DUPLICATE KEY UPDATE
-- First, ensure we have site_product_id populated for existing records
UPDATE products 
SET site_product_id = product_id 
WHERE site_product_id IS NULL AND product_id IS NOT NULL;

-- Create unique index (will fail if duplicates exist - handle manually if needed)
-- Note: MySQL doesn't support IF NOT EXISTS for indexes, so we check first
SET @index_exists = (
  SELECT COUNT(*) 
  FROM information_schema.statistics 
  WHERE table_schema = DATABASE() 
    AND table_name = 'products' 
    AND index_name = 'idx_site_product_id'
);

SET @sql = IF(@index_exists = 0,
  'CREATE UNIQUE INDEX idx_site_product_id ON products(site(128), site_product_id(255))',
  'SELECT "Index already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create product_metrics table for tiering and prioritization
CREATE TABLE IF NOT EXISTS product_metrics (
  product_id VARCHAR(255) PRIMARY KEY,
  search_count_week INT DEFAULT 0,
  last_scraped_at TIMESTAMP NULL,
  tier ENUM('HOT','WARM','COLD') DEFAULT 'COLD',
  is_tracked BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tier (tier),
  INDEX idx_last_scraped_at (last_scraped_at),
  INDEX idx_is_tracked (is_tracked),
  INDEX idx_tier_scraped (tier, last_scraped_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Update existing products: set is_valid = TRUE for products with required fields
UPDATE products 
SET is_valid = TRUE 
WHERE product_name IS NOT NULL 
  AND price IS NOT NULL 
  AND url IS NOT NULL 
  AND site IS NOT NULL
  AND price > 0;

-- Migrate price to price_amount if price_amount is NULL
UPDATE products 
SET price_amount = price 
WHERE price_amount IS NULL AND price IS NOT NULL;

-- Migrate currency to price_currency if price_currency is NULL
UPDATE products 
SET price_currency = COALESCE(currency, 'SAR') 
WHERE price_currency IS NULL;

-- Create index on is_valid for fast filtering
CREATE INDEX IF NOT EXISTS idx_is_valid ON products(is_valid);

-- Create index on last_checked_at for freshness queries
CREATE INDEX IF NOT EXISTS idx_last_checked_at ON products(last_checked_at);
