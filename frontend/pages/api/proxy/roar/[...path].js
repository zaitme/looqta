/**
 * Proxy API route: forwards ROAR admin requests to backend
 * Supports dynamic routes like /api/proxy/roar/auth/login, /api/proxy/roar/users, etc.
 */

// Disable body parsing - we'll handle it manually
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

export default async function handler(req, res) {
  // Next.js dynamic routes: /api/proxy/roar/[...path] captures everything
  // req.query.path will be an array like ['auth', 'login'] or ['users']
  const path = req.query.path;
  const roarPath = path 
    ? (Array.isArray(path) ? '/' + path.join('/') : '/' + path)
    : '';
  
  // Use BACKEND_URL from environment or construct from request hostname
  // This makes it proxy-friendly - works when frontend/backend are on same domain
  let backend;
  if (process.env.BACKEND_URL) {
    backend = process.env.BACKEND_URL;
  } else {
    // Extract hostname from request and use port 4000 for backend
    // This works for LAN access: if accessing via 192.168.8.111:3000, backend is 192.168.8.111:4000
    const hostname = req.headers.host?.split(':')[0] || 'localhost';
    backend = `http://${hostname}:4000`;
  }
  const backendUrl = `${backend}/roar${roarPath}`;
  
  try {
    const options = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    // Forward cookie header - this is critical for session management
    // Cookies are sent automatically by the browser with credentials: 'include'
    if (req.headers.cookie) {
      options.headers['Cookie'] = req.headers.cookie;
    }
    
    // Also forward x-session-token header if present (for compatibility)
    if (req.headers['x-session-token']) {
      options.headers['x-session-token'] = req.headers['x-session-token'];
    }
    
    // Add body for POST/PUT/PATCH requests
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      if (req.body) {
        options.body = JSON.stringify(req.body);
      }
    }
    
    console.log(`[Proxy ROAR] ${req.method} ${backendUrl}`, req.body ? { body: req.body } : '');
    
    const r = await fetch(backendUrl, options);
    
    // Forward response headers, especially Set-Cookie for session management
    // This is critical for cookies to work properly
    const setCookie = r.headers.get('set-cookie');
    if (setCookie) {
      // Set-Cookie header must be set individually, not as array
      res.setHeader('Set-Cookie', setCookie);
    }
    
    // Forward other important headers
    const contentType = r.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    
    if (!r.ok) {
      const errorData = await r.json().catch(() => ({ error: 'Unknown error' }));
      console.error(`[Proxy ROAR] Backend error ${r.status}:`, errorData);
      return res.status(r.status).json({ 
        success: false,
        error: errorData.error || 'Backend request failed'
      });
    }
    
    const json = await r.json();
    res.status(200).json(json);
  } catch (e) {
    console.error('[Proxy ROAR] Error forwarding request:', e);
    console.error('[Proxy ROAR] Error details:', {
      message: e.message,
      stack: e.stack,
      backendUrl,
      method: req.method
    });
    res.status(500).json({ 
      success: false,
      error: 'proxy error', 
      details: e.message
    });
  }
}
