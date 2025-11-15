/**
 * Server-side product utility functions
 * These run on the Next.js server, not in the browser
 */

/**
 * Generate affiliate URL server-side
 * This makes a direct server-to-server call to the backend
 */
export async function generateAffiliateUrlServerSide(productData, backendUrl) {
  try {
    const response = await fetch(`${backendUrl}/api/affiliate/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(productData),
    });
    
    if (!response.ok) {
      return null; // Return null on error, will use original URL
    }
    
    const data = await response.json();
    
    // Construct full redirect URL
    const protocol = process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https') ? 'https' : 'http';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const redirectUrl = data.redirectUrl?.startsWith('http') 
      ? data.redirectUrl 
      : `${siteUrl}${data.redirectUrl}`;
    
    return redirectUrl;
  } catch (error) {
    // Silently fail - return null to use original URL
    return null;
  }
}

/**
 * Generate affiliate URLs for multiple products server-side
 */
export async function generateAffiliateUrlsForProducts(products, backendUrl) {
  if (!products || !Array.isArray(products)) {
    return products;
  }

  // Generate affiliate URLs in parallel (but limit concurrency)
  const BATCH_SIZE = 10;
  const results = [];
  
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    const affiliatePromises = batch.map(async (product) => {
      if (!product.url || !product.site) {
        return { ...product, affiliate_url: product.url };
      }
      
      const affiliateUrl = await generateAffiliateUrlServerSide({
        url: product.url,
        site: product.site,
        productId: product.product_id || product.productId,
        productName: product.product_name || product.name,
        affiliateUrl: product.affiliate_url || product.url
      }, backendUrl);
      
      return {
        ...product,
        affiliate_url: affiliateUrl || product.url
      };
    });
    
    const batchResults = await Promise.all(affiliatePromises);
    results.push(...batchResults);
  }
  
  return results;
}
