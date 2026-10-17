// Seeds the database with demo data for every model.
//   npm run seed -w server            add whatever is missing (keeps existing data)
//   npm run seed:reset -w server      wipe the seeded collections and seed again
// Set SEED_PASSWORD to change the password of the seeded accounts.
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { loadConfig } from '../src/config/env.js';
import { users } from '../seed/data/users.js';
import { DEFAULT_SEED_PASSWORD, seedDatabase } from '../seed/seed.js';

const reset = process.argv.includes('--reset');
const config = loadConfig();

if (config.isProduction) {
  console.error('Refusing to seed: NODE_ENV is production.');
  process.exit(1);
}

const password = process.env.SEED_PASSWORD || DEFAULT_SEED_PASSWORD;

await connectDatabase(config.mongoUri);
try {
  const created = await seedDatabase({ reset, password });
  console.log(reset ? 'Database reset and seeded.' : 'Seed complete.');
  console.table(created);
  console.log(`Accounts (password "${password}"):`);
  console.table(
    users
      .filter((user) => user.email && user.password)
      .map(({ email, role, status, emailVerified }) => ({ email, role, status, emailVerified })),
  );
} finally {
  await disconnectDatabase();
}
