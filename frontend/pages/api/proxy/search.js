/**
 * Proxy API route: forwards search to backend
 */
export default async function handler(req, res){
  const query = req.query.query || req.query.q || '';
  if (!query) {
    return res.status(400).json({ error: 'query required' });
  }
  
  const forceFresh = req.query.forceFresh === 'true' || req.query.fresh === 'true';
  const freshParam = forceFresh ? '&forceFresh=true' : '';
  
  // Use relative URL for proxy support, fallback to env var or localhost
  const backend = process.env.BACKEND_URL || (typeof window === 'undefined' ? 'http://localhost:4000' : '');
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
