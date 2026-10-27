import { closeDb, initDb } from '../db.js';

try {
  await initDb();
  console.log('[db] database ready (demo data is seeded when the database is empty)');
} catch (error) {
  console.error('[db] seeding failed', error);
  process.exitCode = 1;
} finally {
  await closeDb();
}
