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
  // Wrap everything in try-catch to prevent any unhandled errors
  try {
    // Only allow GET requests
    if (req.method !== 'GET') {
      return res.status(405).json({ success: false, ads: [], error: 'Method not allowed' });
    }

  // Use BACKEND_URL from environment or construct from request hostname
  let backend;
  try {
    if (process.env.BACKEND_URL) {
      backend = process.env.BACKEND_URL;
    } else {
      // Extract hostname from request and use port 4000 for backend
      const host = req.headers.host || req.headers['host'] || 'localhost:3000';
      const hostname = host.split(':')[0] || 'localhost';
      backend = `http://${hostname}:4000`;
    }
  } catch (backendError) {
    console.error('[Proxy Ads] Error determining backend URL:', backendError);
    backend = 'http://localhost:4000'; // Fallback
  }
  
  // Build query string from request query params
  let queryString = '';
  try {
    const queryParams = new URLSearchParams();
    if (req.query && req.query.position) {
      queryParams.append('position', String(req.query.position));
    }
    queryString = queryParams.toString();
  } catch (queryError) {
    console.error('[Proxy Ads] Error building query string:', queryError);
    // Continue with empty query string
  }
  
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
    if (contentType && contentType.includes('application/json')) {
      res.setHeader('Content-Type', contentType);
    }
    
    // Try to parse JSON response
    let json;
    try {
      json = await r.json();
    } catch (parseError) {
      console.error('[Proxy Ads] Failed to parse JSON response:', parseError);
      // Return empty ads array instead of error
      return res.status(200).json({ success: true, ads: [] });
    }
    
    // Always return success with ads array (even if backend had errors)
    // This ensures frontend never gets 500 errors
    if (!r.ok) {
      console.warn(`[Proxy Ads] Backend returned ${r.status}, but returning empty ads array`);
      return res.status(200).json({ success: true, ads: [] });
    }
    
    // Ensure response has the expected format
    if (!json || typeof json !== 'object') {
      console.warn('[Proxy Ads] Invalid response format from backend');
      return res.status(200).json({ success: true, ads: [] });
    }
    
    // Normalize response - always return success with ads array
    res.status(200).json({
      success: json.success !== false, // Default to true if not explicitly false
      ads: Array.isArray(json.ads) ? json.ads : []
    });
  } catch (e) {
    // Handle fetch errors (network, timeout, etc.)
    console.error('[Proxy Ads] Error forwarding request:', e);
    console.error('[Proxy Ads] Error details:', {
      message: e.message,
      stack: e.stack,
      name: e.name
    });
    
    // Never return 500 error - always return success with empty ads array
    // This allows frontend to work even when backend is down
    res.status(200).json({ 
      success: true,
      ads: []
    });
  }
  } catch (outerError) {
    // Catch any unexpected errors that weren't caught by inner try-catch
    console.error('[Proxy Ads] Unexpected error in handler:', outerError);
    console.error('[Proxy Ads] Error details:', {
      message: outerError?.message,
      stack: outerError?.stack,
      name: outerError?.name
    });
    
    // Always return success with empty ads array - never return 500
    if (!res.headersSent) {
      res.status(200).json({ 
        success: true,
        ads: []
      });
    }
  }
}
