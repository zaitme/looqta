/**
 * Proxy API route: forwards product alert delete requests to backend
 */
export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { productId, alertId } = req.query;

  if (!productId || !alertId) {
    return res.status(400).json({ error: 'productId and alertId are required' });
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

  const backendUrl = `${backend}/api/products/${productId}/alerts/${alertId}`;

  try {
    const response = await fetch(backendUrl, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return res.status(response.status).json({
        error: errorData.error || 'Backend request failed'
      });
    }
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('[Proxy Products] Error forwarding request:', error);
    res.status(500).json({
      error: 'proxy error',
      details: error.message
    });
  }
}
