import { m } from '@inventory/shared/errorCodes';
import { AppError } from '../utils/AppError.js';

/** True when the user signs in with one of the demo emails in DEMO_EMAILS. */
export function isDemoUser(user, config) {
  return Boolean(user?.email) && config.demoEmails.includes(user.email.toLowerCase());
}

/**
 * Refuses the request for demo accounts. The demo login is shown on the login page, so anyone
 * can use it: it may look at everything, but must not lock out real users or admins. Put it
 * after `protect`, which sets `req.user`.
 */
export function denyDemo(config) {
  return function denyDemoUser(req, _res, next) {
    if (!isDemoUser(req.user, config)) return next();
    next(new AppError(403, 'DEMO_READ_ONLY', m.DEMO_READ_ONLY));
  };
}
