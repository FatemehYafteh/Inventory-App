import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { RefreshToken } from '../../src/models/RefreshToken.js';
import {
  issueRefreshToken,
  rotateRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from '../../src/services/token.service.js';
import { hashToken } from '../../src/utils/crypto.js';
import { createUser, testConfig, useTestDatabase } from '../helpers/setup.js';

useTestDatabase();

const allowAll = { isUserAllowed: async () => true };

describe('access tokens', () => {
  it('round-trips the user id', () => {
    const token = signAccessToken('507f1f77bcf86cd799439011', testConfig);
    expect(verifyAccessToken(token, testConfig)).toBe('507f1f77bcf86cd799439011');
  });

  it('rejects tokens signed with another secret, expired tokens and garbage', () => {
    const foreign = jwt.sign({ typ: 'access' }, 'x'.repeat(32), { subject: 'abc' });
    const expired = jwt.sign({ typ: 'access' }, testConfig.jwt.accessSecret, {
      subject: 'abc',
      expiresIn: -10,
    });
    expect(verifyAccessToken(foreign, testConfig)).toBeNull();
    expect(verifyAccessToken(expired, testConfig)).toBeNull();
    expect(verifyAccessToken('garbage', testConfig)).toBeNull();
    expect(verifyAccessToken(undefined, testConfig)).toBeNull();
  });
});

describe('refresh token rotation', () => {
  it('stores only a hash of the token', async () => {
    const user = await createUser({ password: null });
    const { token, doc } = await issueRefreshToken({ userId: user._id }, testConfig);
    expect(doc.tokenHash).toBe(hashToken(token, testConfig.jwt.refreshSecret));
    expect(doc.tokenHash).not.toContain(token);
  });

  it('revokes the old token and issues a new one in the same family', async () => {
    const user = await createUser({ password: null });
    const first = await issueRefreshToken({ userId: user._id }, testConfig);

    const rotated = await rotateRefreshToken(first.token, allowAll, testConfig);

    expect(rotated.token).not.toBe(first.token);
    const old = await RefreshToken.findById(first.doc._id);
    const next = await RefreshToken.findOne({
      tokenHash: hashToken(rotated.token, testConfig.jwt.refreshSecret),
    });
    expect(old.revokedAt).toBeInstanceOf(Date);
    expect(old.replacedBy.toString()).toBe(next._id.toString());
    expect(next.familyId).toBe(first.doc.familyId);
    expect(next.revokedAt).toBeUndefined();
  });

  it('revokes the whole family when a rotated token is reused', async () => {
    const user = await createUser({ password: null });
    const first = await issueRefreshToken({ userId: user._id }, testConfig);
    const second = await rotateRefreshToken(first.token, allowAll, testConfig);

    await expect(rotateRefreshToken(first.token, allowAll, testConfig)).rejects.toMatchObject({
      status: 401,
    });
    await expect(rotateRefreshToken(second.token, allowAll, testConfig)).rejects.toMatchObject({
      status: 401,
    });
    const active = await RefreshToken.countDocuments({
      familyId: first.doc.familyId,
      revokedAt: null,
    });
    expect(active).toBe(0);
  });

  it('does not touch other families of the same user', async () => {
    const user = await createUser({ password: null });
    const deviceA = await issueRefreshToken({ userId: user._id }, testConfig);
    const deviceB = await issueRefreshToken({ userId: user._id }, testConfig);
    await rotateRefreshToken(deviceA.token, allowAll, testConfig);
    await expect(rotateRefreshToken(deviceA.token, allowAll, testConfig)).rejects.toThrow();

    await expect(rotateRefreshToken(deviceB.token, allowAll, testConfig)).resolves.toBeDefined();
  });

  it('allows only one of two concurrent rotations of the same token', async () => {
    const user = await createUser({ password: null });
    const first = await issueRefreshToken({ userId: user._id }, testConfig);
    const results = await Promise.allSettled([
      rotateRefreshToken(first.token, allowAll, testConfig),
      rotateRefreshToken(first.token, allowAll, testConfig),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('rejects expired, unknown and missing tokens', async () => {
    const user = await createUser({ password: null });
    const { token, doc } = await issueRefreshToken({ userId: user._id }, testConfig);
    await RefreshToken.updateOne({ _id: doc._id }, { expiresAt: new Date(Date.now() - 1000) });

    await expect(rotateRefreshToken(token, allowAll, testConfig)).rejects.toMatchObject({
      status: 401,
    });
    await expect(rotateRefreshToken('unknown', allowAll, testConfig)).rejects.toThrow();
    await expect(rotateRefreshToken(undefined, allowAll, testConfig)).rejects.toThrow();
  });

  it('revokes the family when the user is no longer allowed', async () => {
    const user = await createUser({ password: null });
    const { token, doc } = await issueRefreshToken({ userId: user._id }, testConfig);
    await expect(
      rotateRefreshToken(token, { isUserAllowed: async () => false }, testConfig),
    ).rejects.toMatchObject({ status: 401 });
    expect(await RefreshToken.countDocuments({ familyId: doc.familyId, revokedAt: null })).toBe(0);
  });
});
