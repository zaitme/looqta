/**
 * Atomic Product Upsert Module – FIXED + REFACTORED
 * Ensures validated data is written atomically to DB + cache
 * Fixes: “Field 'name' doesn't have a default value”
 */

const db = require('../db/mysql');
const logger = require('./logger');
const cache = require('../cache/redis');
const { validateRecord } = require('./product-validation');

/**
 * Normalizes product name for ALL scrapers
 */
function resolveName(p) {
  return (
    p.product_name ||
    p.name ||
    p.title ||
    p.productTitle ||
    "Unknown Product"
  );
}

/**
 * Atomic upsert product to database
 */
async function upsertProductAtomic(validatedProduct) {
  let connection;

  const fallbackName = resolveName(validatedProduct);

  try {
    // Check DB availability
    await db.execute('SELECT 1');

    connection = await db.getConnection();
    await connection.beginTransaction();

    const {
      site,
      site_product_id,
      product_id,
      price_amount,
      price_currency,
      url,
      image_url,
      affiliate_link,
      seller_rating,
      seller_rating_count,
      seller_type,
      source_sku,
      shipping_info,
      is_valid,
      trust_score
    } = validatedProduct;

    // INSERT / UPDATE
    const [result] = await connection.execute(
      `INSERT INTO products (
        product_id,
        name,
        price,
        currency,
        url,
        image_url,
        affiliate_url,
        seller_rating,
        seller_rating_count,
        seller_type,
        source_sku,
        shipping_info,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        price = VALUES(price),
        currency = VALUES(currency),
        url = VALUES(url),
        image_url = VALUES(image_url),
        affiliate_url = VALUES(affiliate_url),
        seller_rating = VALUES(seller_rating),
        seller_rating_count = VALUES(seller_rating_count),
        seller_type = VALUES(seller_type),
        source_sku = VALUES(source_sku),
        shipping_info = VALUES(shipping_info),
        updated_at = NOW()`,
      [
        product_id,
        fallbackName,
        price_amount,
        price_currency,
        url,
        image_url,
        affiliate_link,
        seller_rating,
        seller_rating_count,
        seller_type,
        source_sku,
        shipping_info ? JSON.stringify(shipping_info) : null
      ]
    );

    // Get DB ID
    const dbId =
      result.insertId ||
      (await connection.execute(
        `SELECT id FROM products WHERE product_id = ? LIMIT 1`,
        [product_id]
      ))[0]?.[0]?.id;

    // Price history
    if (dbId && price_amount) {
      await connection.execute(
        `INSERT INTO price_history (
          product_id, name, site, url, price, currency, source, scraped_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE price = VALUES(price)`,
        [
          product_id,
          fallbackName,
          site,
          url,
          price_amount,
          price_currency,
          site
        ]
      );
    }

    await connection.commit();

    logger.debug("Product upserted", {
      productId: product_id,
      name: fallbackName,
      price: price_amount
    });

    return { success: true, productId: product_id, dbId };
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch {}
    }

    logger.error("Atomic product upsert failed", {
      productId: validatedProduct.product_id,
      site: validatedProduct.site,
      error: error.message
    });

    throw error;
  } finally {
    if (connection) {
      try { connection.release(); } catch {}
    }
  }
}

/**
 * Batch upsert (10 at a time)
 */
async function upsertProductsBatch(validatedProducts) {
  const results = { success: 0, failed: 0, results: [] };

  try {
    await db.execute('SELECT 1');
  } catch (e) {
    validatedProducts.forEach(() =>
      results.results.push({ success: false, error: "DB unavailable" })
    );
    results.failed = validatedProducts.length;
    return results;
  }

  const batchSize = 10;
  for (let i = 0; i < validatedProducts.length; i += batchSize) {
    const batch = validatedProducts.slice(i, i + batchSize);

    await Promise.allSettled(
      batch.map(async (product) => {
        try {
          const r = await upsertProductAtomic(product);
          results.success++;
          results.results.push({ success: true, productId: r.productId });
        } catch (err) {
          results.failed++;
          results.results.push({
            success: false,
            error: err.message
          });
        }
      })
    );
  }

  return results;
}

/**
 * Redis cache atomic update
 */
async function updateCacheAtomic(cacheKey, data, ttl, source = "scraper") {
  try {
    const redis = cache.client;

    const payload = {
      source,
      fetchedAt: new Date().toISOString(),
      is_stale: false,
      data: Array.isArray(data) ? data : [data]
    };

    await redis
      .multi()
      .set(cacheKey, JSON.stringify(payload), "EX", ttl)
      .exec();

  } catch (e) {
    logger.error("Cache update failed", { key: cacheKey, error: e.message });
  }
}

/**
 * Validate -> DB write -> Cache update
 */
async function validateAndUpsertAtomic(rawProduct, metadata = {}, cacheKey = null, ttlSeconds = 3600) {
  try {
    const validated = validateRecord(rawProduct, metadata);
    const dbResult = await upsertProductAtomic(validated);

    if (cacheKey) {
      await updateCacheAtomic(cacheKey, validated, ttlSeconds, "fresh");
    }

    return { ...dbResult, validated };
  } catch (error) {
    logger.error("Validate and upsert failed", {
      site: rawProduct.site,
      error: error.message
    });
    throw error;
  }
}

module.exports = {
  upsertProductAtomic,
  upsertProductsBatch,
  updateCacheAtomic,
  validateAndUpsertAtomic
};

