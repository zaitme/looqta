/**
 * Proxy API route: forwards product detail requests to backend
 * Fetches product by generated product ID
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { productId } = req.query;

  if (!productId) {
    return res.status(400).json({ error: 'productId is required' });
  }

  // Use BACKEND_URL from environment or construct from request hostname
  let backend;
  try {
    if (process.env.BACKEND_URL) {
      backend = process.env.BACKEND_URL;
    } else {
      const host = req.headers.host || 'localhost:3000';
      const hostname = host.split(':')[0] || 'localhost';
      backend = `http://${hostname}:4000`;
    }
  } catch (backendError) {
    console.error('[Proxy Products] Error determining backend URL:', backendError);
    return res.status(500).json({ error: 'Backend configuration error' });
  }

  // Fetch product from backend by product_id (hash)
  const backendUrl = `${backend}/api/products/${productId}`;

  try {
    const response = await fetch(backendUrl);
    if (!response.ok) {
      // If product not found by ID, return null (product might not exist in DB yet)
      if (response.status === 404) {
        return res.status(404).json({ 
          error: 'Product not found',
          productId 
        });
      }
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return res.status(response.status).json({
        error: errorData.error || 'Backend request failed'
      });
    }
    const data = await response.json();
    
    // Generate affiliate URL server-side if product data is available
    if (data && data.url && data.site) {
      try {
        const { generateAffiliateUrlServerSide } = await import('../../../../utils/serverProductUtils');
        const affiliateUrl = await generateAffiliateUrlServerSide({
          url: data.url,
          site: data.site,
          productId: data.product_id || productId,
          productName: data.product_name || data.name,
        }, backend);
        
        if (affiliateUrl) {
          data.affiliate_url = affiliateUrl;
        }
      } catch (affiliateError) {
        // Silently fail - use original URL
        console.error('[Proxy Products] Error generating affiliate URL:', affiliateError);
      }
    }
    
    res.status(200).json(data);
  } catch (error) {
    console.error('[Proxy Products] Error forwarding request:', error);
    res.status(500).json({
      error: 'proxy error',
      details: error.message
    });
  }
}
