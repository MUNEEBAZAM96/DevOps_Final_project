const { Pool } = require('pg');

function createPool(config) {
  const pool = new Pool({ ...config, max: 10 });
  // An idle connection reports a disconnect here. Without a listener, Node exits.
  pool.on('error', (err) => {
    console.error('database pool error:', err.message);
  });
  return pool;
}

// Values are passed separately from the SQL. Never join user input into the query text.
function createTaskRepository(pool) {
  return {
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS tasks (
          id SERIAL PRIMARY KEY,
          title VARCHAR(200) NOT NULL,
          done BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
    },

    async ping() {
      await pool.query('SELECT 1');
    },

    async list() {
      const { rows } = await pool.query(
        'SELECT id, title, done, created_at FROM tasks ORDER BY id',
      );
      return rows;
    },

    async create(title) {
      const { rows } = await pool.query(
        'INSERT INTO tasks (title) VALUES ($1) RETURNING id, title, done, created_at',
        [title],
      );
      return rows[0];
    },

    async setDone(id, done) {
      const { rows } = await pool.query(
        'UPDATE tasks SET done = $1 WHERE id = $2 RETURNING id, title, done, created_at',
        [done, id],
      );
      return rows[0] || null;
    },

    async remove(id) {
      const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
      return rowCount > 0;
    },
  };
}

module.exports = { createPool, createTaskRepository };
