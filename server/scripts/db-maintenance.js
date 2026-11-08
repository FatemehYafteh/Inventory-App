// One-off database tasks, run by hand or from the "Database maintenance" workflow.
//   npm run db:migrate-initial-reason -w server   old "Initial stock" notes become reason=initial
//   npm run db:sync-indexes -w server             indexes match the schemas (drops unused ones)
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { loadConfig } from '../src/config/env.js';
import { migrateInitialReason } from '../src/maintenance/migrateInitialReason.js';
import { syncAllIndexes } from '../src/maintenance/syncIndexes.js';
// Every model, so syncAllIndexes sees them all.
import '../src/models/AuthRequest.js';
import '../src/models/Category.js';
import '../src/models/EmailSend.js';
import '../src/models/EmailToken.js';
import '../src/models/Product.js';
import '../src/models/RateLimitHit.js';
import '../src/models/RefreshToken.js';
import '../src/models/StatusChange.js';
import '../src/models/StockMovement.js';
import '../src/models/Supplier.js';
import '../src/models/User.js';

const TASKS = {
  'migrate-initial-reason': async () => {
    const changed = await migrateInitialReason();
    console.log(`Movements updated: ${changed}`);
  },
  'sync-indexes': async () => {
    const dropped = await syncAllIndexes();
    console.log('Indexes dropped per model (missing ones were created):');
    const rows = Object.entries(dropped).map(([model, names]) => ({
      model,
      dropped: names.join(', '),
    }));
    console.table(rows);
  },
};

const task = process.argv[2];
if (!TASKS[task]) {
  console.error(`Usage: node scripts/db-maintenance.js <${Object.keys(TASKS).join('|')}>`);
  process.exit(1);
}

const config = loadConfig();
await connectDatabase(config.mongoUri, config.mongo);
try {
  await TASKS[task]();
} finally {
  await disconnectDatabase();
}
