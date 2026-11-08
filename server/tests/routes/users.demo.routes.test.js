import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { StatusChange } from '../../src/models/StatusChange.js';
import { User } from '../../src/models/User.js';
import { ORIGIN, createUser, testEnv, useTestDatabase } from '../helpers/setup.js';

useTestDatabase();

const DEMO_EMAIL = 'demo-admin@example.com';

function buildDemoApp() {
  return createApp(loadConfig({ ...testEnv, DEMO_EMAILS: `other@example.com, ${DEMO_EMAIL}` }));
}

function send(app, method, actor, path, body) {
  const start = request(app)[method](`/api/users/${path}`);
  const req = start.set('Origin', ORIGIN).set('X-Requested-With', 'XMLHttpRequest');
  req.set('x-test-user', actor.id);
  return req.send(body);
}

const admin = (overrides) => createUser({ role: 'admin', status: 'active', ...overrides });
const demoAdmin = () => admin({ name: 'Demo Admin', email: DEMO_EMAIL });

describe('demo accounts on the Users routes', () => {
  it('refuses to reject a real admin and leaves them active', async () => {
    const app = buildDemoApp();
    const demo = await demoAdmin();
    const realAdmin = await admin();

    const res = await send(app, 'patch', demo, `${realAdmin.id}/status`, { status: 'rejected' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('DEMO_READ_ONLY');
    expect(await User.findById(realAdmin._id)).toMatchObject({ status: 'active' });
    expect(await StatusChange.countDocuments()).toBe(0);
  });

  it('refuses to approve a pending user', async () => {
    const app = buildDemoApp();
    const demo = await demoAdmin();
    const user = await createUser({ status: 'pending' });

    const res = await send(app, 'patch', demo, `${user.id}/status`, { status: 'active' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('DEMO_READ_ONLY');
    expect(await User.findById(user._id)).toMatchObject({ status: 'pending' });
  });

  it('refuses to change a role', async () => {
    const app = buildDemoApp();
    const demo = await demoAdmin();
    const realAdmin = await admin();

    const res = await send(app, 'patch', demo, `${realAdmin.id}/role`, { role: 'staff' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('DEMO_READ_ONLY');
    expect(await User.findById(realAdmin._id)).toMatchObject({ role: 'admin' });
  });

  it('matches the demo email case-insensitively', async () => {
    const app = buildDemoApp();
    const demo = await admin({ email: 'Demo-Admin@Example.com' });
    const user = await createUser({ status: 'pending' });

    const res = await send(app, 'patch', demo, `${user.id}/status`, { status: 'active' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('DEMO_READ_ONLY');
  });

  it('still lets the demo account read the Users page and a user detail', async () => {
    const app = buildDemoApp();
    const demo = await demoAdmin();
    const user = await createUser();

    const list = await send(app, 'get', demo, '');
    const detail = await send(app, 'get', demo, user.id);
    const count = await send(app, 'get', demo, 'pending-count');

    expect(list.status).toBe(200);
    expect(detail.status).toBe(200);
    expect(count.status).toBe(200);
  });

  it('still lets a real admin change status and role', async () => {
    const app = buildDemoApp();
    const realAdmin = await admin();
    const user = await createUser({ status: 'pending' });

    const approved = await send(app, 'patch', realAdmin, `${user.id}/status`, { status: 'active' });
    const promoted = await send(app, 'patch', realAdmin, `${user.id}/role`, { role: 'admin' });

    expect(approved.status).toBe(200);
    expect(promoted.status).toBe(200);
    expect(promoted.body.user).toMatchObject({ status: 'active', role: 'admin' });
  });

  it('changes nothing for anyone when DEMO_EMAILS is not set', async () => {
    const app = createApp(loadConfig(testEnv));
    const actor = await admin({ email: DEMO_EMAIL });
    const user = await createUser({ status: 'pending' });

    const res = await send(app, 'patch', actor, `${user.id}/status`, { status: 'active' });

    expect(res.status).toBe(200);
  });
});
