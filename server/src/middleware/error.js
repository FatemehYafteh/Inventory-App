import { m } from '@inventory/shared/errorCodes';
import { AppError } from '../utils/AppError.js';

// Errors the MongoDB driver and Mongoose raise when the database cannot be reached.
const DATABASE_UNAVAILABLE = new Set([
  'MongoServerSelectionError',
  'MongooseServerSelectionError',
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoNotConnectedError',
  'MongoPoolClearedError',
  'MongoPoolClosedError',
  'MongoTopologyClosedError',
]);

function isDatabaseUnavailable(err) {
  // Mongoose queues commands while disconnected and fails them with this message after a while.
  return DATABASE_UNAVAILABLE.has(err?.name) || /buffering timed out/i.test(err?.message ?? '');
}

export function notFound(req, _res, next) {
  next(new AppError(404, 'NOT_FOUND', m.NOT_FOUND));
}

export function errorHandler(err, req, res, _next) {
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

  // A Mongoose cast error is a malformed id or value that reached a query (a route that does
  // not check the id first): the thing asked for does not exist, so 404, not a 500.
  if (err?.name === 'CastError') {
    return res.status(404).json({ message: m.NOT_FOUND, code: 'NOT_FOUND' });
  }
  // A schema rule caught a value the request validation let through.
  if (err?.name === 'ValidationError') {
    return res.status(400).json({ message: m.VALIDATION_FAILED, code: 'VALIDATION_ERROR' });
  }

  // The database cannot be reached (down, restarting, network drop): the user did nothing wrong
  // and a retry will work once it is back, so 503 rather than a generic 500.
  if (isDatabaseUnavailable(err)) {
    if (process.env.NODE_ENV !== 'test') {
      console.error(
        `[db] unavailable on ${req?.method ?? ''} ${req?.originalUrl ?? ''}: ${err.name}`,
      );
    }
    res.set('Retry-After', '5');
    return res.status(503).json({ message: m.SERVICE_UNAVAILABLE, code: 'SERVICE_UNAVAILABLE' });
  }

  if (process.env.NODE_ENV !== 'test') {
    console.error(`[error] ${req?.method ?? ''} ${req?.originalUrl ?? ''}`, err);
  }
  res.status(500).json({ message: m.SOMETHING_WENT_WRONG, code: 'INTERNAL_ERROR' });
}
