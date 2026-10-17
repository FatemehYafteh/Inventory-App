import { authenticate } from './auth.js';
import { requireActive } from './requireActive.js';
import { requireProfile } from './requireProfile.js';
import { requireRole } from './requireRole.js';

/**
 * The access gates for every data route, in this order: authenticate (loads the user from the
 * database), profile complete, status, then role. With no roles, any active user passes.
 * Routes that pending users may call (GET /auth/me, PATCH /auth/profile, ...) do not use it.
 */
export function protect(config, ...roles) {
  return [
    authenticate(config),
    requireProfile,
    requireActive,
    ...(roles.length ? [requireRole(...roles)] : []),
  ];
}
