const { createApp } = require('./app');
const { loadDbConfig } = require('./config');
const { createPool, createTaskRepository } = require('./db');

async function main() {
  const pool = createPool(await loadDbConfig());
  const tasks = createTaskRepository(pool);
  await tasks.init();

  const port = Number(process.env.PORT || 3000);
  const server = createApp({ tasks }).listen(port, () => {
    console.log(`backend listening on port ${port}`);
  });

  // A rolling deployment sends SIGTERM. Finish open requests, then close the pool.
  const shutdown = () => {
    server.close(() => {
      pool.end().then(() => process.exit(0));
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('backend failed to start:', err.message);
  process.exit(1);
});
