import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { User } from '../src/models/User.js';
import { ORIGIN, buildApp, useTestDatabase } from './helpers/setup.js';

useTestDatabase();

const app = buildApp();

afterEach(() => vi.restoreAllMocks());

describe('app', () => {
  it('serves the health check', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('sets security headers from helmet', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('returns the error shape for unknown routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Not found', code: 'NOT_FOUND' });
  });

  it('returns 400 { message, errors } for an invalid body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.errors).toEqual({
      email: 'Enter a valid email address',
      password: 'Password is required',
    });
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });

  describe('CSRF', () => {
    it('rejects a state-changing request without X-Requested-With', async () => {
      const res = await request(app).post('/api/auth/logout').set('Origin', ORIGIN);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('CSRF_REJECTED');
    });

    it('rejects a state-changing request from a foreign origin', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Origin', 'https://evil.example')
        .set('X-Requested-With', 'XMLHttpRequest');
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('CSRF_REJECTED');
    });

    it('allows the client origin with the header', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Origin', ORIGIN)
        .set('X-Requested-With', 'XMLHttpRequest');
      expect(res.status).toBe(204);
    });
  });

  it('hides internal details of unexpected errors', async () => {
    vi.spyOn(User, 'findOne').mockImplementation(() => {
      throw new Error('database password is hunter2');
    });
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'someone@example.com', password: 'whatever-password' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: 'Something went wrong', code: 'INTERNAL_ERROR' });
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
  });
});
