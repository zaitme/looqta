/**
 * Proxy API route: forwards affiliate token requests to backend
 */
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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
    console.error('[Proxy Affiliate] Error determining backend URL:', backendError);
    return res.status(500).json({ error: 'Backend configuration error' });
  }

  const backendUrl = `${backend}/api/affiliate/token`;

  try {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    };

    const response = await fetch(backendUrl, options);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return res.status(response.status).json({
        error: errorData.error || 'Backend request failed'
      });
    }

    const data = await response.json();
    
    // Construct full redirect URL relative to the frontend domain
    // Backend returns redirectUrl like "/r/token123", we need to make it absolute
    const protocol = req.headers['x-forwarded-proto'] || (req.connection.encrypted ? 'https' : 'http');
    const host = req.headers.host || 'localhost:3000';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${host}`;
    const redirectUrl = data.redirectUrl.startsWith('http') 
      ? data.redirectUrl 
      : `${siteUrl}${data.redirectUrl}`;
    
    res.status(200).json({
      ...data,
      redirectUrl: redirectUrl
    });
  } catch (error) {
    console.error('[Proxy Affiliate] Error forwarding request:', error);
    res.status(500).json({
      error: 'proxy error',
      details: error.message
    });
  }
}
