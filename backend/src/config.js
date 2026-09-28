import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env'),
  quiet: true,
});

const DEFAULT_DB_NAME = 'nepal_payroll';

export const port = Number(process.env.PORT) || 4000;

// DATABASE_URL takes priority over the DB_* values
export function databaseName() {
  if (process.env.DATABASE_URL) {
    return decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.slice(1)) || DEFAULT_DB_NAME;
  }
  return process.env.DB_NAME || DEFAULT_DB_NAME;
}

export function databaseConfig(database = databaseName()) {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = `/${encodeURIComponent(database)}`;
    return { connectionString: url.toString() };
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database,
  };
}
