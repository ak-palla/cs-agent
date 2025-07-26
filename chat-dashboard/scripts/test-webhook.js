const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (path === '/api/flock/app-install') {
    if (req.method === 'GET') {
      // Handle challenge validation
      const challenge = parsedUrl.query.challenge;
      if (challenge) {
        console.log('✅ Responding to challenge:', challenge);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(challenge);
      } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Flock app install endpoint ready');
      }
    } else if (req.method === 'POST') {
      // Handle app.install events
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        console.log('🔔 Received app.install event:', body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      });
    }
  } else if (path === '/api/test-app-install') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      message: 'Test endpoint working',
      webhook: `http://localhost:${PORT}/api/flock/app-install`
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Webhook server running on http://localhost:${PORT}`);
  console.log(`📋 Webhook URL: http://localhost:${PORT}/api/flock/app-install`);
  console.log(`📋 Test URL: http://localhost:${PORT}/api/test-app-install`);
  console.log('🔧 To use with Flock, run ngrok: ngrok http 3000');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down server...');
  process.exit(0);
});