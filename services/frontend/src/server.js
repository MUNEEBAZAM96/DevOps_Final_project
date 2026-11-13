const { createApp } = require('./app');

const port = Number(process.env.PORT || 8080);
const server = createApp({ backendUrl: process.env.BACKEND_URL }).listen(port, () => {
  console.log(`frontend listening on port ${port}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
