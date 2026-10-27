import { m } from '@inventory/shared/errorCodes';
import mongoose from 'mongoose';
import { ACCESS_COOKIE } from '../config/cookies.js';
import { User } from '../models/User.js';
import { isRevokedAccessToken, readAccessToken } from '../services/token.service.js';
import { AppError } from '../utils/AppError.js';

function notAuthenticated() {
  return new AppError(401, 'NOT_AUTHENTICATED', m.LOGIN_REQUIRED);
}

/**
 * Authenticates from the access cookie and loads the user from the database on every
 * request, so status changes and ended sessions apply immediately. In NODE_ENV=test only, the
 * `x-test-user` header (a user id) may be used instead of a cookie.
 */
export function authenticate(config) {
  return async function authenticateRequest(req, _res, next) {
    const { user, error } = await resolveUser(req, config);
    if (error) return next(error);
    req.user = user;
    next();
  };
}

/**
 * For public routes that also serve signed-in users (Telegram status and resend, shared by
 * sign-in and Connect Telegram): sets `req.user` when the request is signed in, and never
 * refuses it.
 */
export function identify(config) {
  return async function identifyRequest(req, _res, next) {
    const { user } = await resolveUser(req, config);
    if (user) req.user = user;
    next();
  };
}

/** The signed-in user, or the error that refuses the request. */
async function resolveUser(req, config) {
  const access = readAccessToken(req.cookies?.[ACCESS_COOKIE], config);
  let userId = access?.userId;

  if (!userId && config.isTest && req.get('x-test-user')) {
    userId = req.get('x-test-user');
  }

  if (!userId || !mongoose.isValidObjectId(userId)) return { error: notAuthenticated() };

  const user = await User.findById(userId);
  if (!user) return { error: notAuthenticated() };
  if (access && isRevokedAccessToken(access.issuedAt, user)) return { error: notAuthenticated() };
  if (user.status === 'rejected') {
    return { error: new AppError(403, 'ACCOUNT_REJECTED', m.ACCESS_DENIED) };
  }
  return { user };
}
