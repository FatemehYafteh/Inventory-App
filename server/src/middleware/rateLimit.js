import { m } from '@inventory/shared/errorCodes';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { AppError } from '../utils/AppError.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

function limiter({ windowMs, limit, keyGenerator }) {
  return rateLimit({
    windowMs,
    limit,
    keyGenerator,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', m.TOO_MANY_ATTEMPTS)),
  });
}

/** Per-IP limit. Put it before validation. */
export function perIp(windowMs, limit) {
  return limiter({ windowMs, limit });
}

/** The key of the per-email limit: the email, or the IP when a request carries none. */
export function emailKey(req) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  // ipKeyGenerator groups an IPv6 address by its /56 subnet, so one user cannot dodge the
  // limit by rotating addresses (express-rate-limit 8 checks custom key generators for this).
  return email ? `email:${email}` : `ip:${ipKeyGenerator(req.ip ?? '')}`;
}

/**
 * Per-email limit. Put it after validation, which normalizes `req.body.email`. A request with
 * no email falls back to its IP, so such requests never share one `email:undefined` bucket.
 */
export function perEmail(windowMs, limit) {
  return limiter({ windowMs, limit, keyGenerator: emailKey });
}

export const authLimits = {
  login: () => ({ ip: perIp(15 * MINUTE, 30), email: perEmail(15 * MINUTE, 10) }),
  register: () => ({ ip: perIp(HOUR, 20), email: perEmail(HOUR, 5) }),
  resendVerification: () => ({ ip: perIp(HOUR, 20), email: perEmail(HOUR, 5) }),
  verifyEmail: () => perIp(15 * MINUTE, 30),
  // PRD: 5 reset emails per hour per email and per IP. A team behind one office IP shares
  // the per-IP budget; raise `ip` here if that becomes a problem.
  forgotPassword: () => ({ ip: perIp(HOUR, 5), email: perEmail(HOUR, 5) }),
  resetPassword: () => perIp(15 * MINUTE, 30),
  refresh: () => perIp(15 * MINUTE, 100),
  telegramStart: () => perIp(HOUR, 20),
  telegramVerify: () => perIp(15 * MINUTE, 30),
  telegramResend: () => perIp(HOUR, 20),
  // Connect Telegram: the same budgets as sign-in start and verify.
  telegramConnectStart: () => perIp(HOUR, 20),
  telegramConnectVerify: () => perIp(15 * MINUTE, 30),
  // Changing the email skips the 60 s cooldown; this bounds how fast one person can send.
  completeProfile: () => perIp(HOUR, 20),
  accountLinkConfirm: () => perIp(15 * MINUTE, 10),
  // The sign-in page polls every 2 s.
  telegramStatus: () => perIp(15 * MINUTE, 1200),
};
