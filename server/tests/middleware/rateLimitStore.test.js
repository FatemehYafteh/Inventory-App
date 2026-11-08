import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { MongoRateLimitStore } from '../../src/middleware/rateLimitStore.js';
import { RateLimitHit } from '../../src/models/RateLimitHit.js';
import { ORIGIN, testEnv, useTestDatabase } from '../helpers/setup.js';

useTestDatabase();

function store(prefix, windowMs = 60_000) {
  const result = new MongoRateLimitStore(prefix);
  result.init({ windowMs });
  return result;
}

describe('MongoRateLimitStore', () => {
  it('counts hits per key inside the window and reports when it resets', async () => {
    const limits = store('login:ip');

    const first = await limits.increment('1.2.3.4');
    const second = await limits.increment('1.2.3.4');
    const other = await limits.increment('5.6.7.8');

    expect(first.totalHits).toBe(1);
    expect(second.totalHits).toBe(2);
    expect(second.resetTime.getTime()).toBe(first.resetTime.getTime());
    expect(second.resetTime.getTime()).toBeGreaterThan(Date.now());
    expect(other.totalHits).toBe(1);
  });

  it('starts again at 1 once the window is over', async () => {
    const limits = store('login:ip');
    await limits.increment('1.2.3.4');
    await RateLimitHit.updateOne(
      { _id: 'login:ip:1.2.3.4' },
      { $set: { resetAt: new Date(Date.now() - 1000) } },
    );

    const next = await limits.increment('1.2.3.4');

    expect(next.totalHits).toBe(1);
    expect(next.resetTime.getTime()).toBeGreaterThan(Date.now());
  });

  it('keeps the counters of different limiters apart', async () => {
    await store('login:ip').increment('1.2.3.4');

    expect((await store('register:ip').increment('1.2.3.4')).totalHits).toBe(1);
  });

  it('counts first hits that arrive together', async () => {
    const limits = store('login:ip');

    const results = await Promise.all(Array.from({ length: 5 }, () => limits.increment('9.9.9.9')));

    expect(results.map((r) => r.totalHits).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('reads, decrements and resets a key', async () => {
    const limits = store('login:ip');
    await limits.increment('1.2.3.4');
    await limits.increment('1.2.3.4');

    await limits.decrement('1.2.3.4');
    expect((await limits.get('1.2.3.4')).totalHits).toBe(1);

    await limits.resetKey('1.2.3.4');
    expect(await limits.get('1.2.3.4')).toBeUndefined();
  });
});

describe('Shared rate limits across app instances', () => {
  it('counts login attempts from two instances against one budget', async () => {
    const config = loadConfig({ ...testEnv, RATE_LIMIT_STORE: 'mongo' });
    const instances = [createApp(config), createApp(config)];
    const attempt = (app) =>
      request(app)
        .post('/api/auth/login')
        .set('Origin', ORIGIN)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: 'nobody@example.com', password: 'wrong-password-123' });

    // The per-email budget for login is 10 in 15 minutes.
    for (let i = 0; i < 10; i += 1) await attempt(instances[i % 2]);
    const blocked = await attempt(instances[0]);

    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');
  });
});
