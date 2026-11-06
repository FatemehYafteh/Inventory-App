// Deletes and reseeds the demo catalog (products, stock movements, categories, suppliers) and
// keeps every user, session and sign-in as it is.
//   npm run seed:demo-reset -w server
// Unlike `npm run seed:reset -w server`, which also deletes ALL users and sessions.
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { loadConfig } from '../src/config/env.js';
import { resetDemoData } from '../seed/seed.js';

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
