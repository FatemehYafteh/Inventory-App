import { AppError } from '../utils/AppError.js';

export function notFound(req, _res, next) {
  next(new AppError(404, 'NOT_FOUND', 'Not found'));
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    const body = { message: err.message, code: err.code };
    if (err.errors) body.errors = err.errors;
    return res.status(err.status).json(body);
  }

  // Malformed JSON and oversized bodies from express.json()
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Malformed JSON body', code: 'BAD_REQUEST' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body too large', code: 'PAYLOAD_TOO_LARGE' });
  }

  if (process.env.NODE_ENV !== 'test') console.error(err);
  res.status(500).json({ message: 'Something went wrong', code: 'INTERNAL_ERROR' });
}
