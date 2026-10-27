import { closeDb, initDb } from '../db.js';

try {
  await initDb();
  console.log('[db] schema is up to date');
} catch (error) {
  console.error('[db] initialization failed', error);
  process.exitCode = 1;
} finally {
  await closeDb();
}
