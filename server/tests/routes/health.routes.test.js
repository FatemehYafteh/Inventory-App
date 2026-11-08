import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import { buildApp } from '../helpers/setup.js';

const uri = () => inject('mongoUri');
const dbName = `health_${randomUUID()}`;

beforeAll(async () => {
  await mongoose.connect(uri(), { dbName, serverSelectionTimeoutMS: 1500 });
});

afterAll(async () => {
  await mongoose.connection.dropDatabase().catch(() => {});
  await mongoose.disconnect();
});

describe('GET /api/health (liveness)', () => {
  it('answers ok and is unchanged', async () => {
    const res = await request(buildApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('GET /api/health/ready (readiness)', () => {
  it('answers 200 with the database up, needs no sign-in, and is never cached', async () => {
    const res = await request(buildApp()).get('/api/health/ready');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', database: 'up' });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('answers 503 SERVICE_UNAVAILABLE, with no internals, when the database is disconnected', async () => {
    const app = buildApp();
    await mongoose.disconnect();
    try {
      const started = Date.now();
      const res = await request(app).get('/api/health/ready');

      expect(res.status).toBe(503);
      expect(res.body).toEqual({
        status: 'unavailable',
        database: 'down',
        message: 'Service unavailable',
        code: 'SERVICE_UNAVAILABLE',
      });
      expect(res.headers['retry-after']).toBe('5');
      expect(res.text).not.toMatch(/Mongo|127\.0\.0\.1|stack/i);
      expect(Date.now() - started).toBeLessThan(2000);

      // Liveness does not depend on the database.
      expect((await request(app).get('/api/health')).status).toBe(200);
    } finally {
      await mongoose.connect(uri(), { dbName, serverSelectionTimeoutMS: 1500 });
    }
  });

  it('answers 200 again once the database is back', async () => {
    const res = await request(buildApp()).get('/api/health/ready');
    expect(res.status).toBe(200);
  });

  it('answers 503 within about 3 seconds when the database accepts the connection but never replies', async () => {
    const hang = vi
      .spyOn(mongoose.connection.db, 'admin')
      .mockReturnValue({ ping: () => new Promise(() => {}) });
    try {
      const started = Date.now();
      const res = await request(buildApp()).get('/api/health/ready');

      expect(res.status).toBe(503);
      expect(res.body.database).toBe('down');
      expect(Date.now() - started).toBeGreaterThanOrEqual(2500);
      expect(Date.now() - started).toBeLessThan(6000);
    } finally {
      hang.mockRestore();
    }
  });

  it('limits one IP to 120 checks a minute, then answers 429', async () => {
    const app = buildApp();
    let last;
    for (let i = 0; i < 121; i += 1) last = await request(app).get('/api/health/ready');

    expect(last.status).toBe(429);
    expect(last.body.code).toBe('RATE_LIMITED');
    // The liveness check is not limited.
    expect((await request(app).get('/api/health')).status).toBe(200);
  }, 60_000);
});
