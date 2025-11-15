/**
 * Proxy API route: forwards streaming search to backend
 * Processes SSE events and adds affiliate URLs server-side
 */
import { generateAffiliateUrlServerSide } from '../../../utils/serverProductUtils';

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
    console.error('[Proxy Search Stream] Error determining backend URL:', backendError);
    return res.status(500).json({ error: 'Backend configuration error' });
  }
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
    
    // Process SSE stream and add affiliate URLs to results events
    const reader = backendRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = null;
    let currentData = null;
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.trim() === '') {
            // Empty line indicates end of SSE event
            if (currentEvent && currentData) {
              // Process results events to add affiliate URLs
              if (currentEvent === 'results' && currentData.data && Array.isArray(currentData.data)) {
                const products = currentData.data;
                if (products.length > 0) {
                  // Generate affiliate URLs for products in parallel
                  const affiliatePromises = products.map(async (product) => {
                    if (!product.url || !product.site) {
                      return { ...product, affiliate_url: product.url };
                    }
                    
                    const affiliateUrl = await generateAffiliateUrlServerSide({
                      url: product.url,
                      site: product.site,
                      productId: product.product_id || product.productId,
                      productName: product.product_name || product.name,
                      affiliateUrl: product.affiliate_url || product.url
                    }, backend);
                    
                    return {
                      ...product,
                      affiliate_url: affiliateUrl || product.url
                    };
                  });
                  
                  const updatedProducts = await Promise.all(affiliatePromises);
                  currentData.data = updatedProducts;
                  
                  // Write updated event
                  res.write(`event: ${currentEvent}\n`);
                  res.write(`data: ${JSON.stringify(currentData)}\n\n`);
                } else {
                  // No products, forward as-is
                  res.write(`event: ${currentEvent}\n`);
                  res.write(`data: ${JSON.stringify(currentData)}\n\n`);
                }
              } else {
                // For non-results events, forward as-is
                res.write(`event: ${currentEvent}\n`);
                res.write(`data: ${JSON.stringify(currentData)}\n\n`);
              }
              
              // Reset for next event
              currentEvent = null;
              currentData = null;
            }
            continue;
          }
          
          // Parse SSE lines
          if (line.startsWith('event: ')) {
            currentEvent = line.substring(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const dataStr = line.substring(6); // Remove 'data: ' prefix
              currentData = JSON.parse(dataStr);
            } catch (parseError) {
              // If parsing fails, forward the line as-is
              res.write(line + '\n');
              currentData = null;
            }
          } else {
            // Unknown line format, forward as-is
            res.write(line + '\n');
          }
        }
        
        // Flush to send immediately
        if (typeof res.flush === 'function') {
          res.flush();
        }
      }
      
      // Handle any remaining event in buffer
      if (currentEvent && currentData) {
        res.write(`event: ${currentEvent}\n`);
        res.write(`data: ${JSON.stringify(currentData)}\n\n`);
      }
      
      // Write any remaining buffer
      if (buffer.trim()) {
        res.write(buffer);
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
