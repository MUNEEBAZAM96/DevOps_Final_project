const request = require('supertest');
const { createApp } = require('../src/app');

function fakeTasks() {
  const items = [];
  let nextId = 1;
  return {
    healthy: true,
    async ping() {
      if (!this.healthy) {
        throw new Error('database down');
      }
    },
    async list() {
      return items;
    },
    async create(title) {
      const task = { id: nextId, title, done: false };
      nextId += 1;
      items.push(task);
      return task;
    },
    async setDone(id, done) {
      const task = items.find((item) => item.id === id);
      if (!task) {
        return null;
      }
      task.done = done;
      return task;
    },
    async remove(id) {
      const index = items.findIndex((item) => item.id === id);
      if (index === -1) {
        return false;
      }
      items.splice(index, 1);
      return true;
    },
  };
}

describe('health endpoints', () => {
  test('GET /api/health returns 200 without calling the database', async () => {
    const tasks = fakeTasks();
    tasks.healthy = false;
    tasks.ping = () => {
      throw new Error('database should not be called');
    };

    const res = await request(createApp({ tasks })).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'backend' });
  });

  test('GET /api/health/db returns 200 when the database answers', async () => {
    const res = await request(createApp({ tasks: fakeTasks() })).get('/api/health/db');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', database: 'reachable' });
  });

  test('GET /api/health/db returns 503 when the database is down', async () => {
    const tasks = fakeTasks();
    tasks.healthy = false;

    const res = await request(createApp({ tasks })).get('/api/health/db');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'error', database: 'unreachable' });
  });
});

describe('tasks API', () => {
  let app;

  beforeEach(() => {
    app = createApp({ tasks: fakeTasks() });
  });

  test('creates and lists a task', async () => {
    const created = await request(app).post('/api/tasks').send({ title: '  Write tests  ' });

    expect(created.status).toBe(201);
    expect(created.body.title).toBe('Write tests');

    const list = await request(app).get('/api/tasks');
    expect(list.body).toHaveLength(1);
  });

  test('rejects an empty, missing, or oversized title', async () => {
    const empty = await request(app).post('/api/tasks').send({ title: '   ' });
    const missing = await request(app).post('/api/tasks');
    const oversized = await request(app)
      .post('/api/tasks')
      .send({ title: 'a'.repeat(201) });

    expect(empty.status).toBe(400);
    expect(missing.status).toBe(400);
    expect(oversized.status).toBe(400);
    expect(empty.body.error).toBe('title must be between 1 and 200 characters');
  });

  test('marks a task as done', async () => {
    await request(app).post('/api/tasks').send({ title: 'Deploy' });

    const res = await request(app).patch('/api/tasks/1').send({ done: true });

    expect(res.status).toBe(200);
    expect(res.body.done).toBe(true);
  });

  test('returns 400 for a bad id or a bad done value', async () => {
    expect((await request(app).patch('/api/tasks/abc').send({ done: true })).status).toBe(400);
    expect((await request(app).patch('/api/tasks/1').send({ done: 'yes' })).status).toBe(400);
    expect((await request(app).delete('/api/tasks/0')).status).toBe(400);
  });

  test('returns 404 for a task that does not exist', async () => {
    expect((await request(app).patch('/api/tasks/99').send({ done: true })).status).toBe(404);
    expect((await request(app).delete('/api/tasks/99')).status).toBe(404);
  });

  test('deletes a task', async () => {
    await request(app).post('/api/tasks').send({ title: 'Remove me' });

    const res = await request(app).delete('/api/tasks/1');

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect((await request(app).get('/api/tasks')).body).toHaveLength(0);
  });

  test('returns 500 when the repository throws', async () => {
    const tasks = fakeTasks();
    tasks.list = async () => {
      throw new Error('boom');
    };
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(createApp({ tasks })).get('/api/tasks');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'internal server error' });
    console.error.mockRestore();
  });
});
