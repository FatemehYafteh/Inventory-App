import { isProfileComplete } from '../models/User.js';

/**
 * A user as admins see them on the Users page. Needs `passwordHash` selected, to say whether
 * the user has a password; the hash itself is never returned.
 */
export function toAdminUser(user) {
  return {
    id: user._id.toString(),
    name: user.name ?? null,
    email: user.email ?? null,
    emailVerified: Boolean(user.emailVerified),
    telegramUsername: user.telegramUsername ?? null,
    hasPassword: Boolean(user.passwordHash),
    hasTelegram: Boolean(user.telegramId),
    role: user.role,
    status: user.status,
    profileComplete: isProfileComplete(user),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt ?? null,
    statusChangedAt: user.statusChangedAt ?? null,
    statusChangedBy: user.statusChangedBy ? user.statusChangedBy.toString() : null,
    statusReason: user.statusReason ?? null,
  };
}

/** One status change as the detail drawer lists it. `changedBy` is null for the system. */
export function toStatusChange(change) {
  return {
    id: change._id.toString(),
    from: change.from,
    to: change.to,
    changedBy: change.changedBy ? change.changedBy.toString() : null,
    changedByName: change.changedByName,
    reason: change.reason ?? null,
    at: change.at,
  };
}
