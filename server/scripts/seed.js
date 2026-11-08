// Seeds the database with demo data for every model.
//   npm run seed -w server            add whatever is missing (keeps existing data)
//   npm run seed:reset -w server      wipe the seeded collections and seed again (users too!)
//   npm run seed:demo-reset -w server reseed only the demo catalog and keep every user
// Set SEED_PASSWORD to change the password of the seeded accounts. It is required for any
// database that is not on this machine (see seed/seedPassword.js).
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { loadConfig } from '../src/config/env.js';
import { users } from '../seed/data/users.js';
import { seedDatabase } from '../seed/seed.js';
import { resolveSeedPassword } from '../seed/seedPassword.js';

const reset = process.argv.includes('--reset');
const config = loadConfig();

if (config.isProduction) {
  console.error('Refusing to seed: NODE_ENV is production.');
  process.exit(1);
}

let seed;
try {
  const seedPassword = process.env.SEED_PASSWORD;
  seed = resolveSeedPassword({ mongoUri: config.mongoUri, seedPassword });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const { password, fromEnv } = seed;

await connectDatabase(config.mongoUri);
try {
  const created = await seedDatabase({ reset, password });
  console.log(reset ? 'Database reset and seeded.' : 'Seed complete.');
  console.table(created);
  // Never print a private password into logs (CI logs can be public).
  console.log(
    fromEnv
      ? 'Accounts (password from SEED_PASSWORD):'
      : `Accounts (password "${password}"):`,
  );
  console.table(
    users
      .filter((user) => user.email && user.password)
      .map(({ email, role, status, emailVerified }) => ({ email, role, status, emailVerified })),
  );
} finally {
  await disconnectDatabase();
}
