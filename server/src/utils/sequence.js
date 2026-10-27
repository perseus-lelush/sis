/**
 * Atomic, gap-tolerant sequence allocation.
 *
 * Numbers are handed out from a `counters` row so two requests can never read
 * the same "last value" and produce a duplicate student/invoice number. Both
 * statements must run on the same connection because LAST_INSERT_ID() is
 * connection-scoped.
 */
export async function nextSequence(connection, { counter, prefix, seed = 0, width = 4 }) {
  await connection.query(
    `INSERT INTO counters (name, value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE value = value`,
    [counter, seed],
  );
  await connection.query('UPDATE counters SET value = LAST_INSERT_ID(value + 1) WHERE name = ?', [
    counter,
  ]);
  const [rows] = await connection.query('SELECT LAST_INSERT_ID() AS value');
  return `${prefix}${String(Number(rows[0].value)).padStart(width, '0')}`;
}

/**
 * Highest sequence currently stored in a table, used to seed a counter the
 * first time it is created (for example after importing existing rows).
 */
export async function currentSequence(connection, table, column, prefix) {
  const [rows] = await connection.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(${column}, '-', -1) AS UNSIGNED)), 0) AS value
     FROM ${table}
     WHERE ${column} LIKE ?`,
    [`${prefix}%`],
  );
  return Number(rows[0]?.value || 0);
}
