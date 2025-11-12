-- Migration: Add price history, alerts, and product enhancements
-- Date: 2025-01-XX
-- Purpose: Support price tracking, alerts, seller metadata, and affiliate tracking

USE looqta;

-- Add new columns to products table
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS affiliate_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS seller_rating DECIMAL(3,2) NULL,
  ADD COLUMN IF NOT EXISTS seller_rating_count INT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seller_type VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS source_sku VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS shipping_info JSON NULL,
  ADD COLUMN IF NOT EXISTS image_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS product_id VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Create price_history table
CREATE TABLE IF NOT EXISTS price_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(255) NOT NULL,
  product_name VARCHAR(1024),
  site VARCHAR(128) NOT NULL,
  url TEXT,
  price DECIMAL(12,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'SAR',
  source VARCHAR(128),
  scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_product_id (product_id(255)),
  INDEX idx_site (site),
  INDEX idx_scraped_at (scraped_at),
  INDEX idx_product_site (product_id(255), site),
  INDEX idx_scraped_at_desc (scraped_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create user_price_alerts table
CREATE TABLE IF NOT EXISTS user_price_alerts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  product_id VARCHAR(255) NOT NULL,
  product_name VARCHAR(1024),
  site VARCHAR(128),
  url TEXT,
  target_price DECIMAL(12,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'SAR',
  is_active BOOLEAN DEFAULT TRUE,
  notification_type ENUM('email', 'push', 'both') DEFAULT 'email',
  notified_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id(255)),
  INDEX idx_product_id (product_id(255)),
  INDEX idx_is_active (is_active),
  INDEX idx_user_active (user_id(255), is_active),
  INDEX idx_notified_at (notified_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create affiliate_clicks table for tracking
CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(255),
  product_name VARCHAR(1024),
  site VARCHAR(128),
  url TEXT,
  affiliate_url TEXT,
  user_id VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  fraud_flags JSON NULL,
  clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_product_id (product_id(255)),
  INDEX idx_site (site),
  INDEX idx_user_id (user_id(255)),
  INDEX idx_clicked_at (clicked_at),
  INDEX idx_ip_address (ip_address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create product_shipping table for KSA localization
CREATE TABLE IF NOT EXISTS product_shipping (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(255) NOT NULL,
  site VARCHAR(128) NOT NULL,
  retailer_location VARCHAR(128),
  shipping_estimate_days INT,
  shipping_cost DECIMAL(10,2),
  same_day_available BOOLEAN DEFAULT FALSE,
  fulfilled_by VARCHAR(128),
  city VARCHAR(128),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_product_id (product_id(255)),
  INDEX idx_site (site),
  INDEX idx_city (city),
  INDEX idx_same_day (same_day_available)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create coupons table
CREATE TABLE IF NOT EXISTS coupons (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(255),
  site VARCHAR(128),
  code VARCHAR(100),
  retailer VARCHAR(128),
  discount_type ENUM('percentage', 'fixed', 'free_shipping') DEFAULT 'percentage',
  discount_value DECIMAL(10,2),
  expires_at TIMESTAMP NULL,
  verified BOOLEAN DEFAULT FALSE,
  usage_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_product_id (product_id(255)),
  INDEX idx_site (site),
  INDEX idx_code (code),
  INDEX idx_expires_at (expires_at),
  INDEX idx_verified (verified)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255),
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  verified BOOLEAN DEFAULT FALSE,
  source VARCHAR(128),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_product_id (product_id(255)),
  INDEX idx_user_id (user_id(255)),
  INDEX idx_verified (verified),
  INDEX idx_rating (rating),
  INDEX idx_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
