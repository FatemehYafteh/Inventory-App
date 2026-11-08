import { isProfileComplete } from '../models/User.js';

/** Hides most of an email: 'pat@gmail.com' -> 'p•••@g•••.com'. */
export function maskEmail(email) {
  if (!email) return null;
  const at = email.lastIndexOf('@');
  if (at < 1) return '•••';
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : '';
  return `${email[0]}•••@${host[0] ?? ''}•••${tld}`;
}

/** Hides most of a Telegram username: 'pat_tg' -> 'p•••'. */
export function maskUsername(username) {
  return username ? `${username[0]}•••` : null;
}

/**
 * A user as admins see them on the Users page. Needs `passwordHash` selected, to say whether
 * the user has a password; the hash itself is never returned. `hideContact` (the demo account,
 * which anyone can use) masks the email and the Telegram username.
 */
export function toAdminUser(user, { hideContact = false } = {}) {
  const email = user.email ?? null;
  const telegramUsername = user.telegramUsername ?? null;
  return {
    id: user._id.toString(),
    name: user.name ?? null,
    email: hideContact ? maskEmail(email) : email,
    emailVerified: Boolean(user.emailVerified),
    telegramUsername: hideContact ? maskUsername(telegramUsername) : telegramUsername,
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
