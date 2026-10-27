import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../../src/middleware/error.js';
import { protect } from '../../src/middleware/protect.js';
import { User } from '../../src/models/User.js';
import { ORIGIN, buildApp, createUser, testConfig, useTestDatabase } from '../helpers/setup.js';

useTestDatabase();

// The probe stands in for the data routes that arrive in M5 and later: it sits behind the
// full chain, so what it answers is what every data route will answer.
function probeApp() {
  const app = express();
  app.get('/any', protect(testConfig), (req, res) => res.json({ id: req.user.id }));
  app.get('/admin', protect(testConfig, 'admin'), (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

function get(path, user) {
  const req = request(probeApp()).get(path);
  if (user) req.set('x-test-user', user.id);
  return req;
}

describe('protect', () => {
  it('lets an active user with a complete profile through', async () => {
    const user = await createUser();
    const res = await get('/any', user);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: user.id });
  });

  it('refuses a request with no session', async () => {
    const res = await get('/any');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('NOT_AUTHENTICATED');
  });

  it('refuses an incomplete profile with PROFILE_INCOMPLETE', async () => {
    const user = await createUser({ emailVerified: false, status: 'pending' });
    const res = await get('/any', user);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PROFILE_INCOMPLETE');
  });

  it('refuses a pending user with ACCOUNT_PENDING', async () => {
    const user = await createUser({ status: 'pending' });
    const res = await get('/any', user);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_PENDING');
  });

  it('refuses a rejected user with ACCOUNT_REJECTED', async () => {
    const user = await createUser({ status: 'rejected' });
    const res = await get('/any', user);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_REJECTED');
  });

  it('checks the profile before the status', async () => {
    const user = await createUser({ name: undefined, emailVerified: false, status: 'pending' });
    expect((await get('/any', user)).body.code).toBe('PROFILE_INCOMPLETE');
  });

  it('checks the status before the role', async () => {
    const user = await createUser({ status: 'pending', role: 'staff' });
    expect((await get('/admin', user)).body.code).toBe('ACCOUNT_PENDING');
  });

  it('refuses the wrong role with FORBIDDEN and lets the right one through', async () => {
    const staff = await createUser({ role: 'staff' });
    const admin = await createUser({ role: 'admin' });

    const refused = await get('/admin', staff);
    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe('FORBIDDEN');

    expect((await get('/admin', admin)).status).toBe(200);
  });

  it('reads status and role from the database on every request', async () => {
    const user = await createUser({ role: 'admin', status: 'active' });
    expect((await get('/admin', user)).status).toBe(200);

    await User.updateOne({ _id: user._id }, { role: 'staff' });
    expect((await get('/admin', user)).body.code).toBe('FORBIDDEN');

    await User.updateOne({ _id: user._id }, { status: 'pending' });
    expect((await get('/admin', user)).body.code).toBe('ACCOUNT_PENDING');
  });
});

describe('pending users on /auth', () => {
  function authCall(method, path, user) {
    const req = request(buildApp())[method](`/api/auth${path}`);
    return req
      .set('Origin', ORIGIN)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('x-test-user', user.id);
  }

  it('can still reach me, the profile and logout while waiting for approval', async () => {
    const user = await createUser({ status: 'pending' });

    const me = await authCall('get', '/me', user);
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ status: 'pending', role: 'staff', profileComplete: true });

    expect((await authCall('patch', '/profile', user).send({ name: 'New Name' })).status).toBe(200);
    expect((await authCall('post', '/logout', user)).status).toBe(204);
  });
});
