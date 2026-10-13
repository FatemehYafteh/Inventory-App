import { AppError } from '../utils/AppError.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for state-changing requests, on top of SameSite=Strict cookies:
 * a foreign Origin is refused, and the custom X-Requested-With header is required
 * (a cross-site page cannot send it without a CORS preflight, which we never allow).
 */
export function csrf(config) {
  return function csrfCheck(req, _res, next) {
    if (SAFE_METHODS.has(req.method)) return next();

    const origin = req.get('origin');
    if (origin && origin !== config.clientOrigin) {
      return next(new AppError(403, 'CSRF_REJECTED', 'Request blocked'));
    }
    if (!req.get('x-requested-with')) {
      return next(new AppError(403, 'CSRF_REJECTED', 'Request blocked'));
    }
    next();
  };
}
