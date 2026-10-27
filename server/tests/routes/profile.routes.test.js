import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { User } from '../../src/models/User.js';
import { ORIGIN, buildApp, createUser, useTestDatabase } from '../helpers/setup.js';

useTestDatabase();

function patchProfile(app, user, body) {
  const req = request(app)
    .patch('/api/auth/profile')
    .set('Origin', ORIGIN)
    .set('X-Requested-With', 'XMLHttpRequest');
  if (user) req.set('x-test-user', user.id);
  return req.send(body);
}

describe('PATCH /api/auth/profile', () => {
  it('updates the name of an active or pending user and returns the user', async () => {
    const app = buildApp();
    for (const status of ['active', 'pending']) {
      const user = await createUser({ name: 'Old Name', status });

      const res = await patchProfile(app, user, { name: '  New Name ' });

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ id: user.id, name: 'New Name', status });
      expect((await User.findById(user._id)).name).toBe('New Name');
    }
  });

  it('changes the language alone, and returns it', async () => {
    const user = await createUser({ name: 'Keep Name' });
    expect((await patchProfile(buildApp(), user, {})).status).toBe(400);

    const res = await patchProfile(buildApp(), user, { language: 'fa' });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: 'Keep Name', language: 'fa' });
    expect((await User.findById(user._id)).language).toBe('fa');
  });

  it('refuses an unsupported language', async () => {
    const user = await createUser();
    const res = await patchProfile(buildApp(), user, { language: 'de' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({ language: 'Choose a supported language' });
  });

  it('validates the name with the shared schema', async () => {
    const user = await createUser();
    const res = await patchProfile(buildApp(), user, { name: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({ name: 'Name is required' });
  });

  it('ignores anything but the name', async () => {
    const user = await createUser({ role: 'staff' });
    const res = await patchProfile(buildApp(), user, {
      name: 'Sam',
      role: 'admin',
      email: 'x@y.z',
    });

    expect(res.status).toBe(200);
    const stored = await User.findById(user._id);
    expect(stored.role).toBe('staff');
    expect(stored.email).not.toBe('x@y.z');
  });

  it('is refused while the profile is incomplete, when rejected, or signed out', async () => {
    const app = buildApp();
    const placeholder = await createUser({
      email: undefined,
      emailVerified: false,
      password: null,
      telegramId: '555000111',
      status: 'pending',
    });
    const rejected = await createUser({ status: 'rejected' });

    const incomplete = await patchProfile(app, placeholder, { name: 'Nina' });
    expect(incomplete.status).toBe(403);
    expect(incomplete.body.code).toBe('PROFILE_INCOMPLETE');
    expect((await patchProfile(app, rejected, { name: 'Rex' })).status).toBe(403);
    expect((await patchProfile(app, null, { name: 'Anon' })).status).toBe(401);
  });
});
