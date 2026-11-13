const http = require('node:http');
const path = require('node:path');
const express = require('express');

// Forwards /api to the backend configured by BACKEND_URL. Only the path comes from the request.
function forwardToBackend(backendUrl) {
  const target = new URL(backendUrl);
  return (req, res) => {
    const upstream = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: req.originalUrl,
        method: req.method,
        headers: { ...req.headers, host: target.host },
      },
      (backendRes) => {
        res.writeHead(backendRes.statusCode, backendRes.headers);
        backendRes.pipe(res);
      },
    );
    upstream.on('error', () => {
      if (!res.headersSent) {
        res.status(502).json({ error: 'backend unavailable' });
      }
    });
    req.pipe(upstream);
  };
}

function createApp({ backendUrl } = {}) {
  const app = express();
  app.disable('x-powered-by');

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'frontend' });
  });

  if (backendUrl) {
    app.use('/api', forwardToBackend(backendUrl));
  }

  app.use(express.static(path.join(__dirname, '..', 'public')));
  return app;
}

module.exports = { createApp };
