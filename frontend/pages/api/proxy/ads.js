/**
 * Proxy API route: forwards ad requests to backend
 * Public endpoint - no authentication required
 */

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

export default async function handler(req, res) {
  // Use BACKEND_URL from environment or construct from request hostname
  let backend;
  if (process.env.BACKEND_URL) {
    backend = process.env.BACKEND_URL;
  } else {
    // Extract hostname from request and use port 4000 for backend
    const hostname = req.headers.host?.split(':')[0] || 'localhost';
    backend = `http://${hostname}:4000`;
  }
  
  // Build query string from request query params
  const queryParams = new URLSearchParams();
  if (req.query.position) {
    queryParams.append('position', req.query.position);
  }
  const queryString = queryParams.toString();
  const backendUrl = `${backend}/api/ads${queryString ? '?' + queryString : ''}`;
  
  try {
    const options = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    console.log(`[Proxy Ads] ${req.method} ${backendUrl}`);
    
    const r = await fetch(backendUrl, options);
    
    const contentType = r.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    
    if (!r.ok) {
      const errorData = await r.json().catch(() => ({ error: 'Unknown error' }));
      console.error(`[Proxy Ads] Backend error ${r.status}:`, errorData);
      return res.status(r.status).json({ 
        success: false,
        ads: [],
        error: errorData.error || 'Backend request failed'
      });
    }
    
    const json = await r.json();
    res.status(200).json(json);
  } catch (e) {
    console.error('[Proxy Ads] Error forwarding request:', e);
    res.status(500).json({ 
      success: false,
      ads: [],
      error: 'proxy error', 
      details: e.message
    });
  }
}
