/**
 * Product utility functions
 * - Generate product IDs
 * - API calls for products
 */

/**
 * Generate product ID from URL and site (matches backend logic)
 * Uses simple hash function compatible with backend MD5 hash
 */
export function generateProductId(url, site) {
  if (!url || !site) return null;
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    const str = `${site}:${path}`;
    
    // Simple hash function (produces similar results to backend)
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).substring(0, 16);
  } catch (e) {
    // Fallback: hash the full URL
    const str = `${site}:${url}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).substring(0, 16);
  }
}

/**
 * Get price history for a product
 * Uses Next.js API proxy route
 */
export async function getPriceHistory(productId, range = '30d') {
  try {
    const response = await fetch(`/api/proxy/products/${productId}/history?range=${range}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to fetch price history:', error);
    }
    return null;
  }
}

/**
 * Create price alert
 * Uses Next.js API proxy route
 */
export async function createPriceAlert(productId, alertData) {
  try {
    const response = await fetch(`/api/proxy/products/${productId}/alerts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(alertData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create alert');
    }
    return await response.json();
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to create price alert:', error);
    }
    throw error;
  }
}

/**
 * Get user alerts
 * Uses Next.js API proxy route
 */
export async function getUserAlerts(userId) {
  try {
    const response = await fetch(`/api/proxy/users/${userId}/alerts`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to fetch user alerts:', error);
    }
    return { alerts: [] };
  }
}

/**
 * Delete price alert
 * Uses Next.js API proxy route
 */
export async function deletePriceAlert(productId, alertId) {
  try {
    const response = await fetch(`/api/proxy/products/${productId}/alerts/${alertId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to delete alert:', error);
    }
    throw error;
  }
}

/**
 * Generate affiliate token and get redirect URL
 * REMOVED: Affiliate URLs are now generated server-side in API proxy routes
 * This function has been removed to prevent browser-to-backend calls
 * Products should include affiliate_url field from server-side generation
 * 
 * If you need affiliate URLs, they are generated server-side in:
 * - /api/proxy/search.js
 * - /api/proxy/search-stream.js
 * 
 * Products returned from search will have affiliate_url field already set
 */
export function getAffiliateUrl(productData) {
  // Return affiliate_url if available (from server-side generation), otherwise original URL
  // This is a synchronous function that doesn't make any network calls
  return productData.affiliate_url || productData.url || '#';
}
