const express = require('express');
const request = require('supertest');
const { createApp } = require('../src/app');

describe('frontend server', () => {
  test('GET /health returns 200', async () => {
    const res = await request(createApp()).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'frontend' });
  });

  test('serves the web page', async () => {
    const res = await request(createApp()).get('/');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Task Tracker');
    expect(res.text).not.toContain('innerHTML');
  });

  test('forwards /api requests to the backend', async () => {
    const backend = express();
    backend.get('/api/tasks', (_req, res) => res.json([{ id: 1, title: 'from backend' }]));
    const server = await new Promise((resolve) => {
      const listening = backend.listen(0, '127.0.0.1', () => resolve(listening));
    });
    const { port } = server.address();

    const res = await request(createApp({ backendUrl: `http://127.0.0.1:${port}` })).get(
      '/api/tasks',
    );
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });

    expect(res.status).toBe(200);
    expect(res.body[0].title).toBe('from backend');
  });

  test('returns 502 when the backend cannot be reached', async () => {
    const res = await request(createApp({ backendUrl: 'http://127.0.0.1:1' })).get('/api/tasks');

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'backend unavailable' });
  });

  test.each([
    'ftp://example.com',
    'http://user:password@example.com',
    'http://example.com/api',
    'http://example.com?redirect=https://example.org',
    'http://example.com/#fragment',
  ])('rejects an invalid backend origin: %s', (backendUrl) => {
    expect(() => createApp({ backendUrl })).toThrow(TypeError);
  });

  test('returns 502 when an HTTPS backend cannot be reached', async () => {
    const res = await request(createApp({ backendUrl: 'https://127.0.0.1:1' })).get('/api/tasks');

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'backend unavailable' });
  });
});
