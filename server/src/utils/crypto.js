import { createHmac, randomBytes } from 'node:crypto';

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

/** Random hex secret for env values such as JWT_ACCESS_SECRET (32 bytes = 64 chars). */
export function generateSecret(bytes = 32) {
  return randomBytes(bytes).toString('hex');
}

/**
 * Keyed hash for secrets we store and later look up (refresh, email and start tokens).
 * Lookup is by the full hash, so the raw token is never compared byte by byte.
 */
export function hashToken(token, secret) {
  return createHmac('sha256', secret).update(token).digest('hex');
}
