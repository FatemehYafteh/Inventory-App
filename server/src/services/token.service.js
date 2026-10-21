import { m } from '@inventory/shared/errorCodes';
import jwt from 'jsonwebtoken';
import { RefreshToken } from '../models/RefreshToken.js';
import { REFRESH_TOKEN_TTL_MS } from '../config/cookies.js';
import { AppError } from '../utils/AppError.js';
import { hashToken, randomToken } from '../utils/crypto.js';

const ACCESS_TOKEN_EXPIRES_IN = '15m';

function invalidSession() {
  return new AppError(401, 'INVALID_SESSION', m.SESSION_EXPIRED);
}

export function signAccessToken(userId, config) {
  return jwt.sign({ typ: 'access' }, config.jwt.accessSecret, {
    subject: userId.toString(),
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    algorithm: 'HS256',
  });
}

/** Returns the user id from a valid access token, or null. */
export function verifyAccessToken(token, config) {
  return readAccessToken(token, config)?.userId ?? null;
}

/** Returns `{ userId, issuedAt }` (issuedAt in whole seconds) from a valid access token, or null. */
export function readAccessToken(token, config) {
  try {
    const payload = jwt.verify(token, config.jwt.accessSecret, { algorithms: ['HS256'] });
    return payload.typ === 'access' ? { userId: payload.sub, issuedAt: payload.iat } : null;
  } catch {
    return null;
  }
}

/**
 * True when the user ended all sessions after this access token was issued. Compared in
 * whole seconds (the JWT `iat` precision), so a login right after a reset still works.
 */
export function isRevokedAccessToken(issuedAt, user) {
  if (!user.sessionsRevokedAt || issuedAt === undefined) return false;
  return issuedAt < Math.floor(user.sessionsRevokedAt.getTime() / 1000);
}

/** Creates a refresh token. A new login starts a new family; a rotation keeps the family. */
export async function issueRefreshToken({ userId, familyId, ip, userAgent }, config) {
  const token = randomToken();
  const doc = await RefreshToken.create({
    user: userId,
    familyId: familyId ?? randomToken(16),
    tokenHash: hashToken(token, config.jwt.refreshSecret),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    ip,
    userAgent,
  });
  return { token, doc };
}

/**
 * Revokes the presented refresh token and returns a new one in the same family.
 * Presenting an already revoked token is treated as theft: the whole family is revoked.
 * `isUserAllowed(userId)` lets the caller refuse users who may no longer sign in.
 */
export async function rotateRefreshToken(token, { ip, userAgent, isUserAllowed }, config) {
  if (!token) throw invalidSession();
  const tokenHash = hashToken(token, config.jwt.refreshSecret);
  const now = new Date();

  const current = await RefreshToken.findOneAndUpdate(
    { tokenHash, revokedAt: null, expiresAt: { $gt: now } },
    { $set: { revokedAt: now } },
  );

  if (!current) {
    const existing = await RefreshToken.findOne({ tokenHash });
    if (existing?.revokedAt) await revokeFamily(existing.familyId);
    throw invalidSession();
  }

  if (!(await isUserAllowed(current.user))) {
    await revokeFamily(current.familyId);
    throw invalidSession();
  }

  const next = await issueRefreshToken(
    { userId: current.user, familyId: current.familyId, ip, userAgent },
    config,
  );
  await RefreshToken.updateOne({ _id: current._id }, { $set: { replacedBy: next.doc._id } });
  return { userId: current.user, token: next.token };
}

export async function revokeRefreshToken(token, config) {
  if (!token) return;
  await RefreshToken.updateOne(
    { tokenHash: hashToken(token, config.jwt.refreshSecret), revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

export async function revokeFamily(familyId) {
  await RefreshToken.updateMany({ familyId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

export async function revokeAllForUser(userId, { session } = {}) {
  await RefreshToken.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
    { session },
  );
}
