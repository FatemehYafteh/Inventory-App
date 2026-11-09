// The back end for the end-to-end tests: a real MongoDB (an in-memory replica set, so the stock
// transactions work exactly as in production), one admin account and one category, and the real API
// server (`server/src/index.js`) on port 4000. Playwright starts it, waits for /api/health/ready,
// and stops it when the run ends. Nothing here touches a real database: the data lives in memory.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Category } from '../server/src/models/Category.js';
import { User } from '../server/src/models/User.js';
import { hashPassword } from '../server/src/services/password.service.js';
import { ADMIN } from './credentials.js';

const SERVER_DIR = fileURLToPath(new URL('../server', import.meta.url));
// The client's dev and preview servers proxy /api to this port, and the API only accepts
// requests from this origin (CSRF check), so both are fixed.
const API_PORT = '4000';
const WEB_ORIGIN = 'http://127.0.0.1:5173';

const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: 'wiredTiger' },
});
const uri = new URL(replSet.getUri());
uri.pathname = '/e2e';

await mongoose.connect(uri.toString());
await User.create({
  name: ADMIN.name,
  email: ADMIN.email,
  emailVerified: true,
  role: 'admin',
  status: 'active',
  passwordHash: await hashPassword(ADMIN.password),
});
await Category.create({ title: 'General' });
await mongoose.disconnect();

const api = spawn(process.execPath, ['src/index.js'], {
  cwd: SERVER_DIR,
  // Only what the server needs; nothing from the developer's shell or .env files.
  env: {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    NODE_ENV: 'development',
    PORT: API_PORT,
    MONGODB_URI: uri.toString(),
    JWT_ACCESS_SECRET: 'e2e-access-secret-e2e-access-secret-00',
    JWT_REFRESH_SECRET: 'e2e-refresh-secret-e2e-refresh-secret-1',
    CLIENT_ORIGIN: WEB_ORIGIN,
    APP_URL: WEB_ORIGIN,
    RATE_LIMIT_STORE: 'memory',
  },
  stdio: 'inherit',
});

let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  api.kill();
  await replSet.stop().catch(() => {});
  process.exit(code);
}

api.on('exit', (code) => {
  if (!stopping) {
    console.error(`[e2e] The API server stopped on its own (exit code ${code}).`);
    stop(1);
  }
});
for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK']) process.on(signal, () => stop(0));
process.on('exit', () => api.kill());

console.log('[e2e] Stack ready: in-memory MongoDB, one admin, the API on port', API_PORT);
