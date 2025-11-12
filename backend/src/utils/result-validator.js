/**
 * Result validation utility
 * Filters out invalid results like comments, reviews, non-product content
 */

const logger = require('./logger');

/**
 * Check if a result looks like a valid product (not a comment, review, etc.)
 */
function isValidProduct(result) {
  if (!result) return false;
  
  // Must have product name
  if (!result.product_name || typeof result.product_name !== 'string') {
    return false;
  }
  
  const name = result.product_name.trim();
  
  // Product name must be reasonable length
  if (name.length < 3 || name.length > 500) {
    return false;
  }
  
  // Filter out common non-product patterns
  const invalidPatterns = [
    // Comments/reviews
    /^(comment|review|rating|feedback|opinion)/i,
    /^(أضف تعليق|تعليق|مراجعة|تقييم)/i, // Arabic: add comment, comment, review, rating
    /comment on/i,
    /review by/i,
    /rated by/i,
    /feedback from/i,
    
    // Social media patterns
    /^@\w+/, // Twitter handles
    /^#\w+/, // Hashtags
    /^share on/i,
    /^like this/i,
    /^follow/i,
    
    // Navigation/meta content
    /^(home|about|contact|privacy|terms|help|faq|support)/i,
    /^(الرئيسية|عن|اتصل|خصوصية|شروط|مساعدة)/i, // Arabic navigation
    /^(next|previous|back|more|view all|show more)/i,
    /^(التالي|السابق|رجوع|المزيد|عرض الكل)/i, // Arabic navigation
    
    // Common non-product text
    /^(click here|read more|see more|view details)/i,
    /^(اضغط هنا|اقرأ المزيد|شاهد المزيد|عرض التفاصيل)/i, // Arabic
    /^(add to cart|buy now|checkout)/i,
    /^(أضف للسلة|اشتري الآن|الدفع)/i, // Arabic
    
    // Empty or generic text
    /^(loading|please wait|error|not found|no results)/i,
    /^(جاري التحميل|الرجاء الانتظار|خطأ|غير موجود|لا توجد نتائج)/i, // Arabic
    
    // Date/time patterns (often in comments)
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, // Dates
    /^\d{1,2}:\d{2}/, // Times
    /^(yesterday|today|tomorrow|ago|days? ago)/i,
    /^(أمس|اليوم|غداً|منذ|أيام?)/i, // Arabic
    
    // User names (often in comments)
    /^user\s+\d+/i,
    /^anonymous/i,
    /^guest/i,
    
    // Rating-only text
    /^\d+\s*(star|stars|rating)/i,
    /^\d+\s*(نجمة|نجمات?|تقييم)/i, // Arabic
    
    // Very short generic text
    /^(yes|no|ok|okay|thanks|thank you)/i,
    /^(نعم|لا|حسناً|شكراً)/i, // Arabic
  ];
  
  // Check against invalid patterns
  for (const pattern of invalidPatterns) {
    if (pattern.test(name)) {
      logger.debug('Result filtered: matches invalid pattern', { 
        pattern: pattern.toString(), 
        name: name.substring(0, 50) 
      });
      return false;
    }
  }
  
  // Check for suspicious characteristics
  // Comments often have very short names or are just numbers
  if (name.length < 5 && /^\d+$/.test(name)) {
    return false;
  }
  
  // Comments often don't have URLs or have comment-specific URLs
  if (result.url) {
    const url = result.url.toLowerCase();
    const invalidUrlPatterns = [
      /comment/i,
      /review/i,
      /rating/i,
      /feedback/i,
      /reply/i,
      /reply-to/i,
      /#comment/i,
      /#review/i,
      /reply-to-comment/i,
      /add-comment/i,
      /post-comment/i,
    ];
    
    for (const pattern of invalidUrlPatterns) {
      if (pattern.test(url)) {
        logger.debug('Result filtered: invalid URL pattern', { 
          pattern: pattern.toString(), 
          url: url.substring(0, 100) 
        });
        return false;
      }
    }
  }
  
  // Valid products should have either:
  // 1. A price, OR
  // 2. A valid product URL, OR  
  // 3. An image
  
  const hasPrice = result.price && typeof result.price === 'number' && result.price > 0;
  const hasUrl = result.url && result.url.length > 10 && result.url.startsWith('http');
  const hasImage = result.image && result.image.length > 10 && result.image.startsWith('http');
  
  // At least one of these should be present
  if (!hasPrice && !hasUrl && !hasImage) {
    logger.debug('Result filtered: missing price, URL, and image', { 
      name: name.substring(0, 50) 
    });
    return false;
  }
  
  // Additional validation: product names shouldn't be just numbers or symbols
  const nameWithoutNumbers = name.replace(/\d/g, '').trim();
  if (nameWithoutNumbers.length < 3) {
    logger.debug('Result filtered: name is mostly numbers', { name });
    return false;
  }
  
  return true;
}

/**
 * Validate and filter an array of results
 */
function validateResults(results, scraperName = 'unknown') {
  if (!Array.isArray(results)) {
    logger.warn('validateResults: results is not an array', { scraperName, type: typeof results });
    return [];
  }
  
  const originalCount = results.length;
  const validated = results.filter(result => isValidProduct(result));
  const filteredCount = originalCount - validated.length;
  
  if (filteredCount > 0) {
    logger.info('Result validation filtered out invalid items', {
      scraperName,
      originalCount,
      validatedCount: validated.length,
      filteredCount
    });
  }
  
  return validated;
}

/**
 * Validate a single result
 */
function validateResult(result, scraperName = 'unknown') {
  if (!isValidProduct(result)) {
    logger.debug('Result validation failed', { 
      scraperName,
      name: result?.product_name?.substring(0, 50),
      hasPrice: !!result?.price,
      hasUrl: !!result?.url,
      hasImage: !!result?.image
    });
    return null;
  }
  return result;
}

module.exports = {
  isValidProduct,
  validateResults,
  validateResult
};
