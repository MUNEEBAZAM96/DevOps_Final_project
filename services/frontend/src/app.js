const http = require('node:http');
const https = require('node:https');
const path = require('node:path');
const express = require('express');

// Forwards /api to the backend configured by BACKEND_URL. Only the path comes from the request.
function forwardToBackend(backendUrl) {
  const target = new URL(backendUrl);
  if (
    !['http:', 'https:'].includes(target.protocol) ||
    !target.hostname ||
    target.username ||
    target.password ||
    target.pathname !== '/' ||
    target.search ||
    target.hash
  ) {
    throw new TypeError('BACKEND_URL must be an HTTP(S) origin without credentials or a path');
  }

  const transport = target.protocol === 'https:' ? https : http;

  return (req, res) => {
    // The request target is user-controlled. Reject absolute and network-path URLs so it can
    // never replace the configured backend origin.
    if (
      !req.originalUrl.startsWith('/') ||
      req.originalUrl.startsWith('//') ||
      req.originalUrl.includes('\\')
    ) {
      res.status(400).json({ error: 'invalid request target' });
      return;
    }

    const requestUrl = new URL(req.originalUrl, 'https://frontend.invalid');
    if (requestUrl.origin !== 'https://frontend.invalid') {
      res.status(400).json({ error: 'invalid request target' });
      return;
    }

    const upstream = transport.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: `${requestUrl.pathname}${requestUrl.search}`,
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
