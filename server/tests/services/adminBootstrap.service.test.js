import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/env.js';
import { StatusChange } from '../../src/models/StatusChange.js';
import { User } from '../../src/models/User.js';
import { applyAdminBootstrap } from '../../src/services/adminBootstrap.service.js';
import { createUser, testEnv, useTestDatabase } from '../helpers/setup.js';

useTestDatabase();

const config = loadConfig({
  ...testEnv,
  ADMIN_EMAILS: 'Boss@Example.com, second@example.com',
  ADMIN_TELEGRAM_IDS: '777001,777002',
});

function pendingUser(overrides = {}) {
  return createUser({ status: 'pending', ...overrides });
}

async function promoted(user) {
  const stored = await User.findById(user._id);
  return stored.role === 'admin' && stored.status === 'active';
}

describe('applyAdminBootstrap', () => {
  it('promotes a pending user whose verified email is on the list, ignoring case', async () => {
    const user = await pendingUser({ email: 'boss@example.com' });

    expect(await applyAdminBootstrap(user._id, config)).toBe(true);

    expect(await promoted(user)).toBe(true);
  });

  it('promotes a pending user whose Telegram ID is on the list', async () => {
    const user = await pendingUser({ email: 'tg@example.com', telegramId: '777002' });

    expect(await applyAdminBootstrap(user._id, config)).toBe(true);

    expect(await promoted(user)).toBe(true);
  });

  it('records the promotion as the first status change, made by the system', async () => {
    const user = await pendingUser({ email: 'boss@example.com' });

    await applyAdminBootstrap(user._id, config);

    const history = await StatusChange.find({ user: user._id });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      from: 'pending',
      to: 'active',
      changedBy: null,
      changedByName: 'System (admin list)',
    });
    const stored = await User.findById(user._id);
    expect(stored.statusChangedAt).toBeInstanceOf(Date);
    expect(stored.statusChangedBy).toBeUndefined();
  });

  it('does nothing twice', async () => {
    const user = await pendingUser({ email: 'boss@example.com' });

    await applyAdminBootstrap(user._id, config);
    expect(await applyAdminBootstrap(user._id, config)).toBe(false);

    expect(await StatusChange.countDocuments({ user: user._id })).toBe(1);
  });

  it('does not promote a user who is not on the list', async () => {
    const user = await pendingUser({ email: 'someone@example.com', telegramId: '999999' });

    expect(await applyAdminBootstrap(user._id, config)).toBe(false);

    expect(await promoted(user)).toBe(false);
    expect(await StatusChange.countDocuments()).toBe(0);
  });

  it('does not promote on an unverified email', async () => {
    const user = await pendingUser({ email: 'boss@example.com', emailVerified: false });
    const waiting = await pendingUser({
      email: undefined,
      emailVerified: false,
      pendingEmail: 'second@example.com',
      telegramId: '123',
    });

    expect(await applyAdminBootstrap(user._id, config)).toBe(false);
    expect(await applyAdminBootstrap(waiting._id, config)).toBe(false);

    expect(await promoted(user)).toBe(false);
    expect(await promoted(waiting)).toBe(false);
  });

  it('does not promote a listed Telegram ID until the profile is complete', async () => {
    const user = await pendingUser({
      email: undefined,
      emailVerified: false,
      telegramId: '777001',
    });

    expect(await applyAdminBootstrap(user._id, config)).toBe(false);
  });

  it('leaves a listed user alone once an admin decided otherwise', async () => {
    const rejected = await createUser({ email: 'boss@example.com', status: 'rejected' });
    const demoted = await createUser({
      email: 'second@example.com',
      status: 'active',
      role: 'staff',
    });

    expect(await applyAdminBootstrap(rejected._id, config)).toBe(false);
    expect(await applyAdminBootstrap(demoted._id, config)).toBe(false);

    expect((await User.findById(rejected._id)).status).toBe('rejected');
    const stored = await User.findById(demoted._id);
    expect(stored).toMatchObject({ role: 'staff', status: 'active' });
    expect(await StatusChange.countDocuments()).toBe(0);
  });

  it('does nothing when no admin lists are configured', async () => {
    const user = await pendingUser({ email: 'boss@example.com' });

    expect(await applyAdminBootstrap(user._id, loadConfig(testEnv))).toBe(false);
    expect(await promoted(user)).toBe(false);
  });
});
