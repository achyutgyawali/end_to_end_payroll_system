import { databaseName } from '../src/config.js';
import { setupDatabase } from '../src/db/setup.js';

const reset = process.argv.includes('--reset');

setupDatabase({ reset })
  .then((changed) => {
    if (!changed) console.log(`Database "${databaseName()}" is already set up. Run \`npm run db:reset\` to rebuild it.`);
  })
  .catch((err) => {
    console.error('Database setup failed:', err.message);
    process.exit(1);
  });
