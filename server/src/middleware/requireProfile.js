import { m } from '@inventory/shared/errorCodes';
import { isProfileComplete } from '../models/User.js';
import { AppError } from '../utils/AppError.js';

/**
 * Complete profiles only. While a profile is incomplete the user may call only
 * GET /auth/me, the Complete profile endpoints, POST /auth/refresh and POST /auth/logout;
 * every other authenticated route puts this after `authenticate`.
 */
export function requireProfile(req, _res, next) {
  if (isProfileComplete(req.user)) return next();
  next(new AppError(403, 'PROFILE_INCOMPLETE', m.PROFILE_INCOMPLETE));
}

/** The Complete profile endpoints: only for profiles that are not complete yet. */
export function requireIncompleteProfile(req, _res, next) {
  if (!isProfileComplete(req.user)) return next();
  next(new AppError(409, 'PROFILE_COMPLETE', m.PROFILE_ALREADY_COMPLETE));
}
