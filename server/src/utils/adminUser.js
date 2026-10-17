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
