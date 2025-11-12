/**
 * Proxy API route: forwards ROAR admin requests to backend
 * Supports dynamic routes like /api/proxy/roar/auth/login, /api/proxy/roar/users, etc.
 */
export default async function handler(req, res) {
  // Next.js dynamic routes: /api/proxy/roar/[...path] captures everything
  // req.query.path will be an array like ['auth', 'login'] or ['users']
  const path = req.query.path;
  const roarPath = path 
    ? (Array.isArray(path) ? '/' + path.join('/') : '/' + path)
    : '';
  
  // Use relative URL for proxy support, fallback to env var or localhost
  const backend = process.env.BACKEND_URL || (typeof window === 'undefined' ? 'http://localhost:4000' : '');
  const backendUrl = backend ? `${backend}/roar${roarPath}` : `/roar${roarPath}`;
  
  try {
    const options = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    // Forward session token header if present
    if (req.headers['x-session-token']) {
      options.headers['x-session-token'] = req.headers['x-session-token'];
    }
    
    // Forward cookie header if present
    if (req.headers.cookie) {
      options.headers['Cookie'] = req.headers.cookie;
    }
    
    // Add body for POST/PUT requests
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      options.body = JSON.stringify(req.body);
    }
    
    const r = await fetch(backendUrl, options);
    
    // Forward response headers (especially Set-Cookie for session)
    if (r.headers.get('set-cookie')) {
      res.setHeader('Set-Cookie', r.headers.get('set-cookie'));
    }
    
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
    console.error('[Proxy ROAR] Error forwarding request:', e);
    res.status(500).json({ 
      success: false,
      error: 'proxy error', 
      details: e.message
    });
  }
}
