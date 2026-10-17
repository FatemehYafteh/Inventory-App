import { MongoMemoryReplSet } from 'mongodb-memory-server';

let replSet;

/** One in-memory replica set for the whole run; each test file uses its own database. */
export async function setup({ provide }) {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  provide('mongoUri', replSet.getUri());
}

export async function teardown() {
  await replSet?.stop();
}
