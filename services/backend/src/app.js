const express = require('express');

// The task repository is passed in so tests can use an in-memory version.
function createApp({ tasks }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));

  // Load balancer check. It must not touch the database, or one database
  // problem would mark every instance unhealthy at the same time.
  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'backend' });
  });

  app.get('/api/health/db', async (_req, res) => {
    try {
      await tasks.ping();
      res.status(200).json({ status: 'ok', database: 'reachable' });
    } catch {
      res.status(503).json({ status: 'error', database: 'unreachable' });
    }
  });

  app.get('/api/tasks', async (_req, res) => {
    res.json(await tasks.list());
  });

  app.post('/api/tasks', async (req, res) => {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (title.length === 0 || title.length > 200) {
      return res.status(400).json({
        error: 'title must be between 1 and 200 characters',
      });
    }
    res.status(201).json(await tasks.create(title));
  });

  app.patch('/api/tasks/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'id must be a positive whole number' });
    }
    if (typeof req.body?.done !== 'boolean') {
      return res.status(400).json({ error: 'done must be true or false' });
    }
    const task = await tasks.setDone(id, req.body.done);
    if (!task) {
      return res.status(404).json({ error: 'task not found' });
    }
    res.json(task);
  });

  app.delete('/api/tasks/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'id must be a positive whole number' });
    }
    const removed = await tasks.remove(id);
    if (!removed) {
      return res.status(404).json({ error: 'task not found' });
    }
    res.status(204).end();
  });

  // Express 5 forwards errors from async handlers to this middleware.
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  });

  return app;
}

module.exports = { createApp };
