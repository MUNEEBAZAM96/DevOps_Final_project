const { createPool, createTaskRepository } = require('../src/db');

function fakePool(result = { rows: [], rowCount: 0 }) {
  return { query: jest.fn().mockResolvedValue(result) };
}

describe('task repository', () => {
  test('creates the table on init', async () => {
    const pool = fakePool();
    await createTaskRepository(pool).init();
    expect(pool.query.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS tasks');
  });

  test('uses a placeholder for the title, never string joining', async () => {
    const pool = fakePool({ rows: [{ id: 1, title: 'x' }] });
    await createTaskRepository(pool).create("x'); DROP TABLE tasks; --");

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('VALUES ($1)');
    expect(params).toEqual(["x'); DROP TABLE tasks; --"]);
  });

  test('returns null when updating a task that does not exist', async () => {
    const repo = createTaskRepository(fakePool({ rows: [] }));
    expect(await repo.setDone(5, true)).toBeNull();
  });

  test('reports whether a delete removed a row', async () => {
    expect(await createTaskRepository(fakePool({ rowCount: 1 })).remove(1)).toBe(true);
    expect(await createTaskRepository(fakePool({ rowCount: 0 })).remove(1)).toBe(false);
  });

  test('lists tasks and pings the database', async () => {
    const pool = fakePool({ rows: [{ id: 1 }] });
    const repo = createTaskRepository(pool);

    expect(await repo.list()).toEqual([{ id: 1 }]);
    await repo.ping();
    expect(pool.query).toHaveBeenLastCalledWith('SELECT 1');
  });

  test('creates a pool limited to 10 connections', async () => {
    const pool = createPool({
      host: '127.0.0.1',
      port: 1,
      database: 'tasks',
      user: 'app',
      password: 'change-me',
    });

    expect(pool.options.max).toBe(10);
    expect(pool.listenerCount('error')).toBe(1);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    pool.emit('error', new Error('connection terminated'));
    expect(console.error).toHaveBeenCalledWith('database pool error:', 'connection terminated');
    console.error.mockRestore();
    await pool.end();
  });
});
