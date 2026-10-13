import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { consumeEmailToken, isInCooldown, issueEmailToken } from './emailToken.service.js';
import {
  passwordChangedTemplate,
  resetPasswordTemplate,
  verifyEmailTemplate,
} from './mail.templates.js';
import { hashPassword, verifyDummyPassword, verifyPassword } from './password.service.js';
import {
  issueRefreshToken,
  revokeAllForUser,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
} from './token.service.js';

export const MAX_FAILED_LOGINS = 5;
export const LOCK_DURATION_MS = 15 * 60 * 1000;

function invalidCredentials() {
  return new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
}

/**
 * Counts a failed attempt atomically. The 5th consecutive failure locks the account
 * for 15 minutes and resets the counter.
 */
async function recordFailedLogin(userId) {
  const lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
  const reachedLimit = { $gte: ['$failedLoginCount', MAX_FAILED_LOGINS] };
  await User.updateOne({ _id: userId }, [
    { $set: { failedLoginCount: { $add: [{ $ifNull: ['$failedLoginCount', 0] }, 1] } } },
    {
      $set: {
        lockedUntil: { $cond: [reachedLimit, lockUntil, '$lockedUntil'] },
        failedLoginCount: { $cond: [reachedLimit, 0, '$failedLoginCount'] },
      },
    },
  ]);
}

async function startSession(user, { ip, userAgent }, config) {
  const refresh = await issueRefreshToken({ userId: user._id, ip, userAgent }, config);
  return { accessToken: signAccessToken(user._id, config), refreshToken: refresh.token };
}

/**
 * Email + password login. Every credential failure (unknown email, no password, wrong
 * password, locked account, unverified email) gives the same error and similar timing.
 */
export async function loginWithPassword({ email, password }, meta, config) {
  const user = await User.findOne({ email }).select('+passwordHash');

  if (!user?.passwordHash) {
    await verifyDummyPassword(password);
    throw invalidCredentials();
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await verifyDummyPassword(password);
    throw invalidCredentials();
  }

  if (!(await verifyPassword(user.passwordHash, password))) {
    await recordFailedLogin(user._id);
    throw invalidCredentials();
  }

  if (!user.emailVerified) throw invalidCredentials();

  if (user.status === 'rejected') {
    throw new AppError(403, 'ACCOUNT_REJECTED', 'Access denied');
  }

  user.failedLoginCount = 0;
  user.lockedUntil = undefined;
  user.lastLoginAt = new Date();
  await user.save();

  return { user, tokens: await startSession(user, meta, config) };
}

export async function refreshSession(refreshToken, meta, config) {
  const { userId, token } = await rotateRefreshToken(
    refreshToken,
    {
      ...meta,
      isUserAllowed: async (id) => {
        const user = await User.findById(id).select('status');
        return Boolean(user) && user.status !== 'rejected';
      },
    },
    config,
  );
  return { accessToken: signAccessToken(userId, config), refreshToken: token };
}

export async function logout(refreshToken, config) {
  await revokeRefreshToken(refreshToken, config);
}

/** Issues a verification token and emails the link, unless one was sent within the cooldown. */
async function sendVerificationEmail(user, { config, mailer }) {
  if (await isInCooldown(user._id, 'verify_email')) return;
  const token = await issueEmailToken(
    { userId: user._id, type: 'verify_email', email: user.email },
    config,
  );
  const link = `${config.appUrl}/verify-email?token=${encodeURIComponent(token)}`;
  mailer.sendInBackground({ to: user.email, ...verifyEmailTemplate({ name: user.name, link }) });
}

/**
 * Email sign-up. The caller always gets the same response, so this never reveals whether
 * the email is taken: a new address gets an account and a verification link, an existing
 * unverified email account gets a fresh link, and anything else gets nothing.
 */
export async function register({ name, email, password }, { config, mailer }) {
  // Hash before looking up so both paths take about the same time.
  const passwordHash = await hashPassword(password);
  const existing = await User.findOne({ email }).select('+passwordHash');

  if (existing) {
    if (!existing.emailVerified && existing.passwordHash) {
      await sendVerificationEmail(existing, { config, mailer });
    }
    return;
  }

  let user;
  try {
    user = await User.create({ name, email, passwordHash, emailVerified: false });
  } catch (err) {
    if (err?.code === 11000) return; // Registered concurrently; treat as existing.
    throw err;
  }
  await sendVerificationEmail(user, { config, mailer });
}

export async function resendVerification({ email }, { config, mailer }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (user && !user.emailVerified && user.passwordHash) {
    await sendVerificationEmail(user, { config, mailer });
  }
}

/** Consumes a verification link and marks the email verified, in one transaction. */
export async function verifyEmail({ token }, config) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const doc = await consumeEmailToken({ token, type: 'verify_email', session }, config);
      const updated = await User.updateOne(
        { _id: doc.user, email: doc.email },
        { $set: { emailVerified: true } },
        { session },
      );
      if (updated.matchedCount === 0) {
        throw new AppError(400, 'INVALID_TOKEN', 'This link is invalid or has expired.');
      }
    });
  } finally {
    await session.endSession();
  }
}

/**
 * Emails a reset link (or a "set your password" link for an account with no password yet).
 * The caller always gets the same response; nothing is sent for unknown, unverified or
 * rejected accounts, or within the resend cooldown.
 */
export async function forgotPassword({ email }, { config, mailer }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !user.emailVerified || user.status === 'rejected') return;
  if (await isInCooldown(user._id, 'reset_password')) return;

  const token = await issueEmailToken(
    { userId: user._id, type: 'reset_password', email: user.email },
    config,
  );
  const link = `${config.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
  mailer.sendInBackground({
    to: user.email,
    ...resetPasswordTemplate({ name: user.name, link, hasPassword: Boolean(user.passwordHash) }),
  });
}

/**
 * Sets a new password from a reset link, in one transaction: uses up the link, clears the
 * login lock, and ends every session (refresh tokens revoked, older access tokens refused).
 * Does not log the user in.
 */
export async function resetPassword({ token, password }, { config, mailer }) {
  // Hash outside the transaction to keep it short.
  const passwordHash = await hashPassword(password);
  const session = await mongoose.startSession();
  let before;
  try {
    await session.withTransaction(async () => {
      const doc = await consumeEmailToken({ token, type: 'reset_password', session }, config);
      // The same conditions as when the link was sent, checked again in case they changed.
      before = await User.findOneAndUpdate(
        { _id: doc.user, email: doc.email, emailVerified: true, status: { $ne: 'rejected' } },
        {
          $set: { passwordHash, sessionsRevokedAt: new Date(), failedLoginCount: 0 },
          $unset: { lockedUntil: 1 },
        },
        { session, new: false },
      ).select('+passwordHash');
      if (!before) {
        throw new AppError(400, 'INVALID_TOKEN', 'This link is invalid or has expired.');
      }
      await revokeAllForUser(before._id, { session });
    });
  } finally {
    await session.endSession();
  }

  mailer.sendInBackground({
    to: before.email,
    ...passwordChangedTemplate({
      name: before.name,
      forgotLink: `${config.appUrl}/forgot-password`,
      firstPassword: !before.passwordHash,
    }),
  });
}
