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
  // Wrap everything in try-catch to prevent any unhandled errors
  try {
    // Next.js dynamic routes: /api/proxy/roar/[...path] captures everything
    // req.query.path will be an array like ['auth', 'login'] or ['users']
    const path = req.query.path;
    const roarPath = path 
      ? (Array.isArray(path) ? '/' + path.join('/') : '/' + path)
      : '';
    
    // Use BACKEND_URL from environment or construct from request hostname
    // This makes it proxy-friendly - works when frontend/backend are on same domain
    let backend;
    try {
      if (process.env.BACKEND_URL) {
        backend = process.env.BACKEND_URL;
      } else {
        // Extract hostname from request and use port 4000 for backend
        // This works for LAN access: if accessing via 192.168.8.111:3000, backend is 192.168.8.111:4000
        const host = req.headers.host || req.headers['host'] || 'localhost:3000';
        const hostname = host.split(':')[0] || 'localhost';
        backend = `http://${hostname}:4000`;
      }
    } catch (backendError) {
      console.error('[Proxy ROAR] Error determining backend URL:', backendError);
      backend = 'http://localhost:4000'; // Fallback
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
          try {
            options.body = JSON.stringify(req.body);
          } catch (bodyError) {
            console.error('[Proxy ROAR] Error stringifying body:', bodyError);
            // Continue without body if stringification fails
          }
        }
      }
      
      console.log(`[Proxy ROAR] ${req.method} ${backendUrl}`);
      
      const r = await fetch(backendUrl, options);
      
      // Forward response headers, especially Set-Cookie for session management
      // This is critical for cookies to work properly
      try {
        const setCookie = r.headers.get('set-cookie');
        if (setCookie) {
          // Set-Cookie header must be set individually, not as array
          res.setHeader('Set-Cookie', setCookie);
        }
      } catch (headerError) {
        console.error('[Proxy ROAR] Error setting Set-Cookie header:', headerError);
        // Continue even if header setting fails
      }
      
      // Forward other important headers
      const contentType = r.headers.get('content-type');
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }
      
      // Try to parse JSON response
      let json;
      try {
        json = await r.json();
      } catch (parseError) {
        console.error('[Proxy ROAR] Failed to parse JSON response:', parseError);
        return res.status(r.status || 500).json({ 
          success: false,
          error: 'Invalid response from backend'
        });
      }
      
      if (!r.ok) {
        console.error(`[Proxy ROAR] Backend error ${r.status}:`, json);
        return res.status(r.status).json({ 
          success: false,
          error: json.error || 'Backend request failed'
        });
      }
      
      res.status(200).json(json);
    } catch (fetchError) {
      console.error('[Proxy ROAR] Error forwarding request:', fetchError);
      console.error('[Proxy ROAR] Error details:', {
        message: fetchError?.message,
        stack: fetchError?.stack,
        name: fetchError?.name,
        backendUrl,
        method: req.method
      });
      
      // Return proper error response
      return res.status(500).json({ 
        success: false,
        error: 'Proxy error',
        details: fetchError?.message || 'Failed to forward request to backend'
      });
    }
  } catch (outerError) {
    // Catch any unexpected errors that weren't caught by inner try-catch
    console.error('[Proxy ROAR] Unexpected error in handler:', outerError);
    console.error('[Proxy ROAR] Error details:', {
      message: outerError?.message,
      stack: outerError?.stack,
      name: outerError?.name
    });
    
    // Return proper error response
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false,
        error: 'Proxy error',
        details: outerError?.message || 'Unexpected error occurred'
      });
    }
  }
}
