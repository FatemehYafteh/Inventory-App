import { AppError } from '../utils/AppError.js';

/** The user's role, read from the database by `authenticate`, must be one of `roles`. */
export function requireRole(...roles) {
  return function requireRoleOf(req, _res, next) {
    if (roles.includes(req.user.role)) return next();
    next(new AppError(403, 'FORBIDDEN', 'You do not have access to this.'));
  };
}
