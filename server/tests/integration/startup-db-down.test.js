import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, describe, expect, inject, it } from 'vitest';
import handler from '../../../api/index.js';
import { getApp } from '../../src/serverless.js';
import { testEnv } from '../helpers/setup.js';

const SERVER_DIR = fileURLToPath(new URL('../..', import.meta.url));

/** A port nothing listens on: connecting to it is refused immediately, like a stopped database. */
const closedPort = () =>
  new Promise((resolve) => {
    const probe = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

const env = (mongoUri) => ({
  ...testEnv,
  NODE_ENV: 'development',
  MONGODB_URI: mongoUri,
  MONGO_SERVER_SELECTION_TIMEOUT_MS: '1500',
  JWT_ACCESS_SECRET: 'integration-access-secret-integration-access',
  JWT_REFRESH_SECRET: 'integration-refresh-secret-integration-refresh',
  RATE_LIMIT_STORE: 'memory',
});

afterAll(async () => {
  await mongoose.disconnect().catch(() => {});
});

describe('the database is down when the server starts', () => {
  it('the long-running server exits with a clear message and a failure code instead of hanging', async () => {
    const port = await closedPort();
    const child = spawn(process.execPath, ['src/index.js'], {
      cwd: SERVER_DIR,
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        ...env(`mongodb://127.0.0.1:${port}/inventory?directConnection=true`),
        NODE_ENV: 'development',
        PORT: String(await closedPort()),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', (c) => (output += c));

    const started = Date.now();
    const code = await new Promise((resolve) => {
      const timer = setTimeout(() => {
        child.kill();
        resolve('hung');
      }, 20_000);
      child.on('exit', (exitCode) => {
        clearTimeout(timer);
        resolve(exitCode);
      });
    });

    expect(code).toBe(1);
    expect(output).toContain('Failed to start server');
    expect(Date.now() - started).toBeLessThan(15_000);
  }, 40_000);
});

describe('the Vercel entry point when the database is down, then back', () => {
  it('answers 503 SERVICE_UNAVAILABLE as JSON, and does not cache the failure', async () => {
    const port = await closedPort();
    Object.assign(process.env, env(`mongodb://127.0.0.1:${port}/inventory?directConnection=true`));

    const res = {
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value;
      },
      end(body) {
        this.body = body;
      },
    };
    await handler({ method: 'GET', url: '/api/products', headers: {} }, res);

    expect(res.statusCode).toBe(503);
    expect(res.headers['content-type']).toBe('application/json');
    expect(JSON.parse(res.body)).toEqual({
      message: 'Service unavailable',
      code: 'SERVICE_UNAVAILABLE',
    });
    expect(res.body).not.toMatch(/Mongo|ECONNREFUSED|127\.0\.0\.1/);
  }, 30_000);

  it('the next request retries the connection and succeeds once the database is back', async () => {
    const realUri = new URL(inject('mongoUri'));
    realUri.pathname = `/it_${randomUUID()}`;
    Object.assign(process.env, env(realUri.toString()));

    const app = await getApp();
    const health = await request(app).get('/api/health');

    expect(health.status).toBe(200);
    expect(health.body).toEqual({ status: 'ok' });
  }, 30_000);
});
