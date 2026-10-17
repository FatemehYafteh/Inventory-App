import mongoose from 'mongoose';
import { StatusChange } from '../models/StatusChange.js';
import { User, isProfileComplete } from '../models/User.js';

export const SYSTEM_NAME = 'System (admin list)';

function isListed(user, { emails, telegramIds }) {
  const listedEmails = emails.map((email) => email.toLowerCase());
  return (
    Boolean(user.email && listedEmails.includes(user.email)) ||
    Boolean(user.telegramId && telegramIds.includes(user.telegramId))
  );
}

async function promote(userId, config, session) {
  const user = await User.findById(userId).session(session);
  // Only a pending user with a complete profile (a verified email): an admin's later decision
  // (rejected, demoted, already active) is never overridden by the list.
  if (!user || user.status !== 'pending' || !isProfileComplete(user)) return false;
  if (!isListed(user, config.admins)) return false;

  const promoted = await User.findOneAndUpdate(
    { _id: user._id, status: 'pending', emailVerified: true },
    {
      $set: { role: 'admin', status: 'active', statusChangedAt: new Date() },
      $unset: { statusChangedBy: 1, statusReason: 1 },
    },
    { session },
  );
  if (!promoted) return false;

  await StatusChange.create(
    [
      {
        user: user._id,
        from: 'pending',
        to: 'active',
        changedBy: null,
        changedByName: SYSTEM_NAME,
      },
    ],
    { session },
  );
  return true;
}

/**
 * Admin bootstrap: a pending user whose verified email is in ADMIN_EMAILS, or whose Telegram
 * ID is in ADMIN_TELEGRAM_IDS, becomes admin and active, recorded as a status change made by
 * the system. Call it wherever a profile becomes complete or gains Telegram. Idempotent;
 * returns whether it promoted the user. Pass the caller's `session` to join its transaction.
 */
export async function applyAdminBootstrap(userId, config, { session } = {}) {
  const { emails, telegramIds } = config.admins;
  if (!emails.length && !telegramIds.length) return false;
  if (session) return promote(userId, config, session);

  const own = await mongoose.startSession();
  try {
    let promoted = false;
    await own.withTransaction(async () => {
      promoted = await promote(userId, config, own);
    });
    return promoted;
  } finally {
    await own.endSession();
  }
}
