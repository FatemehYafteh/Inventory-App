// Starts a local single-node MongoDB replica set for development (transactions need one).
// Data is kept in server/.dev-db so it survives restarts.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const dbPath = fileURLToPath(new URL('../.dev-db', import.meta.url));
mkdirSync(dbPath, { recursive: true });

const replSet = await MongoMemoryReplSet.create({
  replSet: { name: 'rs0', count: 1, storageEngine: 'wiredTiger' },
  instanceOpts: [{ port: 27017, dbPath }],
});

console.log(`MongoDB replica set running: ${replSet.getUri('inventory')}`);
console.log('Press Ctrl+C to stop.');

process.on('SIGINT', async () => {
  await replSet.stop({ doCleanup: false });
  process.exit(0);
});
