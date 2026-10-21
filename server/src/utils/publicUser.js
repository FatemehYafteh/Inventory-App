import { isProfileComplete } from '../models/User.js';

/** The only user shape sent to clients. Never includes hashes or lockout data. */
export function toPublicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name ?? null,
    email: user.email ?? null,
    emailVerified: Boolean(user.emailVerified),
    // The email waiting for verification on Complete profile.
    pendingEmail: user.pendingEmail ?? null,
    telegramConnected: Boolean(user.telegramId),
    telegramUsername: user.telegramUsername ?? null,
    language: user.language ?? 'en',
    role: user.role,
    status: user.status,
    profileComplete: isProfileComplete(user),
  };
}
