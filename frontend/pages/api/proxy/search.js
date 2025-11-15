/**
 * Proxy API route: forwards search to backend
 * Generates affiliate URLs server-side for all products
 */
import { generateAffiliateUrlsForProducts } from '../../../utils/serverProductUtils';

export default async function handler(req, res){
  const query = req.query.query || req.query.q || '';
  if (!query) {
    return res.status(400).json({ error: 'query required' });
  }
  
  const forceFresh = req.query.forceFresh === 'true' || req.query.fresh === 'true';
  const freshParam = forceFresh ? '&forceFresh=true' : '';
  
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
    console.error('[Proxy Search] Error determining backend URL:', backendError);
    return res.status(500).json({ error: 'Backend configuration error', fromCache: false, data: [] });
  }
  const backendUrl = backend ? `${backend}/api/search` : '/api/search';
  try {
    const r = await fetch(`${backendUrl}?q=${encodeURIComponent(query)}${freshParam}`);
    
    // Check if response is ok
    if (!r.ok) {
      const errorData = await r.json().catch(() => ({ error: 'Unknown error' }));
      return res.status(r.status).json({ 
        error: errorData.error || 'Backend request failed',
        fromCache: false,
        data: []
      });
    }
    
    const json = await r.json();
    
    // Generate affiliate URLs server-side for all products
    if (json.data && Array.isArray(json.data) && json.data.length > 0) {
      json.data = await generateAffiliateUrlsForProducts(json.data, backend);
    }
    
    res.status(200).json(json);
  } catch (e) {
    console.error('[Proxy] Error forwarding search request:', e);
    res.status(500).json({ 
      error: 'proxy error', 
      details: e.message,
      fromCache: false,
      data: []
    });
  }
}
