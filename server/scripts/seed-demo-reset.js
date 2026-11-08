// Deletes and reseeds the demo catalog (products, stock movements, categories, suppliers) and
// keeps every user, session and sign-in as it is.
//   npm run seed:demo-reset -w server
// Unlike `npm run seed:reset -w server`, which also deletes ALL users and sessions.
// Runs only with DEMO_MODE=true (put it in server/.env for local use), checked before anything
// else, so a wrong environment can never reach the database.
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { loadConfig } from '../src/config/env.js';
import { demoModeRefusal } from '../seed/demoMode.js';
import { resetDemoData } from '../seed/seed.js';

const refusal = demoModeRefusal(process.env);
if (refusal) {
  console.error(refusal);
  process.exit(1);
}

const config = loadConfig();

if (config.isProduction) {
  console.error('Refusing to reset demo data: NODE_ENV is production.');
  process.exit(1);
}

await connectDatabase(config.mongoUri);
try {
  const result = await resetDemoData();
  console.log('Demo data reset. Users and sessions were not touched.');
  console.table(result);
} finally {
  await disconnectDatabase();
}
