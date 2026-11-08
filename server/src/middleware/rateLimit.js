import { m } from '@inventory/shared/errorCodes';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { AppError } from '../utils/AppError.js';
import { MongoRateLimitStore } from './rateLimitStore.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/**
 * `name` identifies the limiter: with the MongoDB store (RATE_LIMIT_STORE=mongo, the default in
 * production) it keeps the counters of different limiters apart. Without a config, or with the
 * memory store, each limiter counts in this process only.
 */
function limiter({ windowMs, limit, keyGenerator, name, config }) {
  const store =
    config?.rateLimitStore === 'mongo' && name ? new MongoRateLimitStore(name) : undefined;
  return rateLimit({
    windowMs,
    limit,
    keyGenerator,
    ...(store && { store, passOnStoreError: true }),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', m.TOO_MANY_ATTEMPTS)),
  });
}

/** Per-IP limit. Put it before validation. */
export function perIp(windowMs, limit, { name, config } = {}) {
  return limiter({ windowMs, limit, name: name && `${name}:ip`, config });
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
export function perEmail(windowMs, limit, { name, config } = {}) {
  const id = name && `${name}:email`;
  return limiter({ windowMs, limit, keyGenerator: emailKey, name: id, config });
}

// Each limiter has a name, which keeps its counters apart in the shared store.
const byIp = (name, windowMs, limit) => (config) => perIp(windowMs, limit, { name, config });
const byIpAndEmail = (name, [ipWindow, ipLimit], [emailWindow, emailLimit]) => (config) => ({
  ip: perIp(ipWindow, ipLimit, { name, config }),
  email: perEmail(emailWindow, emailLimit, { name, config }),
});

/** Call each with the app config: `authLimits.login(config)`. */
export const authLimits = {
  login: byIpAndEmail('login', [15 * MINUTE, 30], [15 * MINUTE, 10]),
  register: byIpAndEmail('register', [HOUR, 20], [HOUR, 5]),
  resendVerification: byIpAndEmail('resendVerification', [HOUR, 20], [HOUR, 5]),
  verifyEmail: byIp('verifyEmail', 15 * MINUTE, 30),
  // PRD: 5 reset emails per hour per email and per IP. A team behind one office IP shares
  // the per-IP budget; raise `ip` here if that becomes a problem.
  forgotPassword: byIpAndEmail('forgotPassword', [HOUR, 5], [HOUR, 5]),
  resetPassword: byIp('resetPassword', 15 * MINUTE, 30),
  refresh: byIp('refresh', 15 * MINUTE, 100),
  telegramStart: byIp('telegramStart', HOUR, 20),
  telegramVerify: byIp('telegramVerify', 15 * MINUTE, 30),
  telegramResend: byIp('telegramResend', HOUR, 20),
  // Connect Telegram: the same budgets as sign-in start and verify.
  telegramConnectStart: byIp('telegramConnectStart', HOUR, 20),
  telegramConnectVerify: byIp('telegramConnectVerify', 15 * MINUTE, 30),
  // Changing the email skips the 60 s cooldown; this bounds how fast one person can send.
  completeProfile: byIp('completeProfile', HOUR, 20),
  accountLinkConfirm: byIp('accountLinkConfirm', 15 * MINUTE, 10),
  // The sign-in page polls every 2 s.
  telegramStatus: byIp('telegramStatus', 15 * MINUTE, 1200),
};
