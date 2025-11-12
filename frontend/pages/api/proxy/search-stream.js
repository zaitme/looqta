/**
 * Proxy API route: forwards streaming search to backend
 * Note: Next.js API routes don't support streaming well, so we'll use a workaround
 */
export default async function handler(req, res) {
  // Disable body parsing for streaming
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const query = req.query.query || req.query.q || '';
  if (!query) {
    return res.status(400).json({ error: 'query required' });
  }
  
  const forceFresh = req.query.forceFresh === 'true' || req.query.fresh === 'true';
  const freshParam = forceFresh ? '&forceFresh=true' : '';
  
  // Use relative URL for proxy support, fallback to env var or localhost
  const backend = process.env.BACKEND_URL || 'http://localhost:4000';
  const backendUrl = backend ? `${backend}/api/search/stream` : '/api/search/stream';
  
  try {
    // Set up SSE headers before making backend request
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
    
    // Flush headers
    res.flushHeaders();
    
    // Forward the SSE stream to the client
    const backendRes = await fetch(`${backendUrl}?q=${encodeURIComponent(query)}${freshParam}`, {
      headers: {
        'Accept': 'text/event-stream',
      }
    });
    
    if (!backendRes.ok) {
      const errorData = await backendRes.text().catch(() => 'Unknown error');
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ error: 'Backend request failed', details: errorData })}\n\n`);
      res.end();
      return;
    }
    
    if (!backendRes.body) {
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ error: 'No response body' })}\n\n`);
      res.end();
      return;
    }
    
    // Pipe the backend response to the client
    const reader = backendRes.body.getReader();
    const decoder = new TextDecoder();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
        // Flush to send immediately
        if (typeof res.flush === 'function') {
          res.flush();
        }
      }
    } finally {
      reader.releaseLock();
    }
    
    res.end();
  } catch (e) {
    console.error('[Proxy Stream] Error forwarding search request:', e);
    try {
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ error: 'proxy error', details: e.message })}\n\n`);
      res.end();
    } catch (writeError) {
      // Response might already be closed
      console.error('[Proxy Stream] Error writing error response:', writeError);
    }
  }
}
