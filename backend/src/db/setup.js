import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { databaseConfig, databaseName } from '../config.js';

const dbDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'db');

async function withClient(database, work) {
  const client = new pg.Client(databaseConfig(database));
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

async function runFile(client, file) {
  const sql = await fs.readFile(path.join(dbDir, file), 'utf8');
  await client.query(sql);
  console.log(`  applied db/${file}`);
}

async function createDatabaseIfMissing(dbName) {
  try {
    await withClient(dbName, () => {});
    return;
  } catch (err) {
    if (err.code !== '3D000') throw err; // 3D000 = database does not exist
  }
  await withClient('postgres', (client) =>
    // identifiers can't be parameterized, so escape it instead
    client.query(`CREATE DATABASE ${pg.escapeIdentifier(dbName)}`),
  );
  console.log(`Created database "${dbName}"`);
}

// Creates the database and loads schema + seed if they aren't there yet.
// Returns false when everything was already set up.
export async function setupDatabase({ reset = false } = {}) {
  const dbName = databaseName();
  await createDatabaseIfMissing(dbName);

  return withClient(dbName, async (client) => {
    if (reset) {
      await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
      console.log(`Cleared database "${dbName}"`);
    } else {
      const { rows } = await client.query("SELECT to_regclass('public.employees') AS existing");
      if (rows[0].existing) return false;
    }
    await runFile(client, 'schema.sql');
    await runFile(client, 'seed.sql');
    console.log(`Database "${dbName}" is ready`);
    return true;
  });
}
