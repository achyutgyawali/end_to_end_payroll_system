import pg from 'pg';
import { databaseConfig } from '../config.js';

// DATE -> 'YYYY-MM-DD' string: avoids JS Date timezone shifts on plain dates.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);
// NUMERIC -> number (amounts here are well within double precision).
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => parseFloat(value));
// BIGINT (e.g. COUNT(*)) -> number.
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => parseInt(value, 10));

export const pool = new pg.Pool(databaseConfig());

// Runs work(client) in a transaction, rolls back on error
export async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
