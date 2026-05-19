/**
 * Simple CORS Proxy for LM Studio
 * Run this locally to bypass CORS issues
 * 
 * Usage:
 *   node llm-proxy.js
 *   Then point your frontend to: http://localhost:3000
 */

const http = require('http');
const https = require('https');

const LM_STUDIO_URL = 'http://127.0.0.1:1234';
const PROXY_PORT = 3000;

const server = http.createServer(async (req, res) => {
  // Enable CORS for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
 res.writeHead(200);
    res.end();
    return;
  }

  // Proxy the actual request
  if (req.method === 'POST' && req.url === '/v1/chat/completions') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      // Forward to LM Studio
      const options = {
  hostname: '127.0.0.1',
     port: 1234,
        path: '/v1/chat/completions',
     method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      };

   const proxyReq = http.request(options, (proxyRes) => {
   res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        console.error('Proxy error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Proxy error: ' + err.message }));
  });

      proxyReq.write(body);
      proxyReq.end();
});
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PROXY_PORT, '127.0.0.1', () => {
  console.log(`? CORS Proxy running on http://127.0.0.1:${PROXY_PORT}`);
  console.log(`?? Forwarding to LM Studio at ${LM_STUDIO_URL}`);
  console.log(`\n?? Update your HTML to use: http://127.0.0.1:${PROXY_PORT}/v1/chat/completions`);
});
