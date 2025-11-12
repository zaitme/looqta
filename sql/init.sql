-- MySQL DDL for Looqta
CREATE DATABASE IF NOT EXISTS looqta CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE looqta;

CREATE TABLE IF NOT EXISTS products (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  query VARCHAR(512) NOT NULL,
  product_name VARCHAR(1024),
  site VARCHAR(128),
  price DECIMAL(12,2),
  currency VARCHAR(8),
  url TEXT,
  snapshot_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_query ON products(query(255));
