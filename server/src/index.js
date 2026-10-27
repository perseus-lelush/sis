import app from './app.js';
import { config } from './config.js';
import { closeDb, initDb } from './db.js';

async function start() {
  console.log(`[db] initializing ${config.dbMode} MySQL connection...`);
  await initDb();
  console.log('[db] ready');

  const server = app.listen(config.port, () => {
    console.log(`[api] listening on http://localhost:${config.port}`);
  });

  const shutdown = async () => {
    console.log('[api] shutting down...');
    server.close();
    await closeDb();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((error) => {
  console.error('[api] failed to start', error);
  process.exit(1);
});
