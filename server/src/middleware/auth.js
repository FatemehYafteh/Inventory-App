import mongoose from 'mongoose';
import { ACCESS_COOKIE } from '../config/cookies.js';
import { User } from '../models/User.js';
import { verifyAccessToken } from '../services/token.service.js';
import { AppError } from '../utils/AppError.js';

function notAuthenticated() {
  return new AppError(401, 'NOT_AUTHENTICATED', 'Please log in to continue.');
}

/**
 * Authenticates from the access cookie and loads the user from the database on every
 * request, so status changes apply immediately. In NODE_ENV=test only, the
 * `x-test-user` header (a user id) may be used instead of a cookie.
 */
export function authenticate(config) {
  const allowTestHeader = config.isTest;

  return async function authenticateRequest(req, _res, next) {
    let userId = verifyAccessToken(req.cookies?.[ACCESS_COOKIE], config);

    if (!userId && allowTestHeader && req.get('x-test-user')) {
      userId = req.get('x-test-user');
    }

    if (!userId || !mongoose.isValidObjectId(userId)) return next(notAuthenticated());

    const user = await User.findById(userId);
    if (!user) return next(notAuthenticated());
    if (user.status === 'rejected') {
      return next(new AppError(403, 'ACCOUNT_REJECTED', 'Access denied'));
    }

    req.user = user;
    next();
  };
}
