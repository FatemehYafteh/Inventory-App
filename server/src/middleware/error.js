import { m } from '@inventory/shared/errorCodes';
import { AppError } from '../utils/AppError.js';

export function notFound(req, _res, next) {
  next(new AppError(404, 'NOT_FOUND', m.NOT_FOUND));
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    const body = { message: err.message, code: err.code };
    if (err.errors) body.errors = err.errors;
    if (err.details) body.details = err.details;
    if (err.errorCodes) body.errorCodes = err.errorCodes;
    return res.status(err.status).json(body);
  }

  // Malformed JSON and oversized bodies from express.json()
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ message: m.MALFORMED_JSON, code: 'BAD_REQUEST' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ message: m.PAYLOAD_TOO_LARGE, code: 'PAYLOAD_TOO_LARGE' });
  }

  if (process.env.NODE_ENV !== 'test') console.error(err);
  res.status(500).json({ message: m.SOMETHING_WENT_WRONG, code: 'INTERNAL_ERROR' });
}
