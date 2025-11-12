/**
 * Proxy API route: forwards admin requests to backend
 * Supports dynamic routes like /api/proxy/admin/scrapers, /api/proxy/admin/cache/clear, etc.
 */
export default async function handler(req, res) {
  // Next.js dynamic routes: /api/proxy/admin/[...path] captures everything
  // req.query.path will be an array like ['scrapers'] or ['cache', 'clear']
  const path = req.query.path;
  const adminPath = path 
    ? (Array.isArray(path) ? '/' + path.join('/') : '/' + path)
    : '';
  
  // Use relative URL for proxy support, fallback to env var or localhost
  const backend = process.env.BACKEND_URL || (typeof window === 'undefined' ? 'http://localhost:4000' : '');
  const backendUrl = backend ? `${backend}/api/admin${adminPath}` : `/api/admin${adminPath}`;
  
  try {
    const options = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    // Add body for POST/PUT requests
    if (req.method === 'POST' || req.method === 'PUT') {
      options.body = JSON.stringify(req.body);
    }
    
    const r = await fetch(backendUrl, options);
    
    if (!r.ok) {
      const errorData = await r.json().catch(() => ({ error: 'Unknown error' }));
      return res.status(r.status).json({ 
        success: false,
        error: errorData.error || 'Backend request failed'
      });
    }
    
    const json = await r.json();
    res.status(200).json(json);
  } catch (e) {
    console.error('[Proxy Admin] Error forwarding request:', e);
    res.status(500).json({ 
      success: false,
      error: 'proxy error', 
      details: e.message
    });
  }
}
