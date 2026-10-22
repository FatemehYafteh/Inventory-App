import { m } from '@inventory/shared/errorCodes';
import { AppError } from '../utils/AppError.js';

/**
 * Approved users only. A pending user may call only the routes that do not use this: GET
 * /auth/me, PATCH /auth/profile, the Telegram connect endpoints, logout and refresh. Rejected
 * users never get here: `authenticate` refuses them with ACCOUNT_REJECTED.
 */
export function requireActive(req, _res, next) {
  if (req.user.status === 'active') return next();
  next(new AppError(403, 'ACCOUNT_PENDING', m.ACCOUNT_PENDING));
}
