import { rateLimit } from 'express-rate-limit';
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
    handler: (_req, _res, next) =>
      next(new AppError(429, 'RATE_LIMITED', 'Too many attempts. Please try again later.')),
  });
}

/** Per-IP limit. Put it before validation. */
export function perIp(windowMs, limit) {
  return limiter({ windowMs, limit });
}

/** Per-email limit. Put it after validation, which normalizes `req.body.email`. */
export function perEmail(windowMs, limit) {
  return limiter({ windowMs, limit, keyGenerator: (req) => `email:${req.body.email}` });
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
  // The sign-in page polls every 2 s.
  telegramStatus: () => perIp(15 * MINUTE, 300),
};
