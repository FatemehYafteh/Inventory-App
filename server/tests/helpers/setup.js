import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, inject } from 'vitest';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { User } from '../../src/models/User.js';
import { hashPassword } from '../../src/services/password.service.js';

export const testConfig = loadConfig({
  NODE_ENV: 'test',
  MONGODB_URI: 'provided-by-global-setup',
  JWT_ACCESS_SECRET: 'test-access-secret-test-access-secret',
  JWT_REFRESH_SECRET: 'test-refresh-secret-test-refresh-secret',
  CLIENT_ORIGIN: 'http://localhost:5173',
  APP_URL: 'http://localhost:5173',
});

export const ORIGIN = testConfig.clientOrigin;

/** Connects mongoose to a fresh database for this test file and empties it after each test. */
export function useTestDatabase() {
  beforeAll(async () => {
    await mongoose.connect(inject('mongoUri'), { dbName: `test_${randomUUID()}` });
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  });
  afterEach(async () => {
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map((collection) => collection.deleteMany({})));
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
}

export function buildApp() {
  return createApp(testConfig);
}

export const DEFAULT_PASSWORD = 'correct-horse-battery';

export async function createUser(overrides = {}) {
  const { password = DEFAULT_PASSWORD, ...fields } = overrides;
  return User.create({
    name: 'Test User',
    email: `user-${randomUUID()}@example.com`,
    emailVerified: true,
    role: 'staff',
    status: 'active',
    passwordHash: password ? await hashPassword(password) : undefined,
    ...fields,
  });
}

/** Parses Set-Cookie headers into { name: { value, attributes } }. */
export function parseCookies(res) {
  const result = {};
  for (const header of res.headers['set-cookie'] ?? []) {
    const [pair, ...attrs] = header.split(';').map((part) => part.trim());
    const index = pair.indexOf('=');
    result[pair.slice(0, index)] = {
      value: pair.slice(index + 1),
      attributes: attrs.map((attr) => attr.toLowerCase()),
    };
  }
  return result;
}
