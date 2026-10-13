import { EmailToken } from '../models/EmailToken.js';
import { AppError } from '../utils/AppError.js';
import { hashToken, randomToken } from '../utils/crypto.js';

export const EMAIL_TOKEN_TTL_MS = {
  verify_email: 24 * 60 * 60 * 1000,
  reset_password: 30 * 60 * 1000,
  link_telegram: 30 * 60 * 1000,
};

/** Minimum time between two emails of the same type to the same user. */
export const RESEND_COOLDOWN_MS = 60 * 1000;

function invalidToken() {
  return new AppError(400, 'INVALID_TOKEN', 'This link is invalid or has expired.');
}

/** True when a token of this type was issued to the user within the resend cooldown. */
export async function isInCooldown(userId, type) {
  const recent = await EmailToken.exists({
    user: userId,
    type,
    usedAt: null,
    createdAt: { $gt: new Date(Date.now() - RESEND_COOLDOWN_MS) },
  });
  return Boolean(recent);
}

/**
 * Creates a single-use email token and returns the raw value for the link.
 * Any earlier unused token of the same type for the user stops working.
 */
export async function issueEmailToken({ userId, type, email, targetUser }, config) {
  await EmailToken.deleteMany({ user: userId, type, usedAt: null });
  const token = randomToken();
  await EmailToken.create({
    user: userId,
    type,
    email,
    targetUser,
    tokenHash: hashToken(token, config.jwt.refreshSecret),
    expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS[type]),
  });
  return token;
}

/** Marks a valid token as used and returns it. Throws INVALID_TOKEN otherwise. */
export async function consumeEmailToken({ token, type, session }, config) {
  const now = new Date();
  const doc = await EmailToken.findOneAndUpdate(
    {
      tokenHash: hashToken(token, config.jwt.refreshSecret),
      type,
      usedAt: null,
      expiresAt: { $gt: now },
    },
    { $set: { usedAt: now } },
    { new: true, session },
  );
  if (!doc) throw invalidToken();
  return doc;
}
