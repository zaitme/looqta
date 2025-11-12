-- Migration: Add url column if missing
-- Date: 2025-11-12
-- Purpose: Ensure url column exists in products table for backward compatibility

USE looqta;

-- Add url column if it doesn't exist
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS url TEXT NULL AFTER currency;

-- Update url from affiliate_url if url is NULL and affiliate_url exists
UPDATE products 
SET url = affiliate_url 
WHERE url IS NULL AND affiliate_url IS NOT NULL;
