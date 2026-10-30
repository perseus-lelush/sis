import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { createDB } from 'mysql-memory-server';
import { config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let pool = null;
let embeddedServer = null;

export async function initDb() {
  if (pool) return pool;

  let connectionOptions;

  if (config.dbMode === 'embedded') {
    embeddedServer = await createDB({
      version: process.env.MYSQL_VERSION || '8.4.x',
      dbName: config.db.name,
      username: 'root',
      xEnabled: 'OFF',
      logLevel: 'ERROR',
      downloadBinaryOnce: true,
    });
    connectionOptions = {
      host: '127.0.0.1',
      port: embeddedServer.port,
      user: embeddedServer.username,
      password: '',
      database: embeddedServer.dbName,
    };
  } else {
    connectionOptions = {
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.name,
    };

    if (config.autoInit) {
      const admin = await mysql.createConnection({
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
      });
      await admin.query(`CREATE DATABASE IF NOT EXISTS \`${config.db.name}\``);
      await admin.end();
    }
  }

  pool = mysql.createPool({
    ...connectionOptions,
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,
    decimalNumbers: true,
    multipleStatements: true,
  });

  if (config.autoInit) {
    const schema = await readFile(path.join(__dirname, 'sql', 'schema.sql'), 'utf8');
    await pool.query(schema);
    const { seedDatabase } = await import('./seed-data.js');
    await seedDatabase(pool);
  }

  return pool;
}

export async function getPool() {
  return pool || initDb();
}

export async function query(sql, params) {
  const activePool = await getPool();
  const [rows] = await activePool.query(sql, params);
  return rows;
}

export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
  }
  if (embeddedServer) {
    await embeddedServer.stop();
    embeddedServer = null;
  }
}
