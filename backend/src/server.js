import { createApp } from './app.js';
import { databaseName, port } from './config.js';
import { setupDatabase } from './db/setup.js';

try {
  await setupDatabase();
} catch (err) {
  console.error(`Cannot set up database "${databaseName()}": ${err.message}`);
  console.error('Check the DB_* values in backend/.env');
  process.exit(1);
}

createApp().listen(port, () => {
  console.log(`Payroll API listening on http://localhost:${port}`);
});
