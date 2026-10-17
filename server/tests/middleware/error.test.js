import { describe, expect, it } from 'vitest';
import { errorHandler } from '../../src/middleware/error.js';
import { AppError } from '../../src/utils/AppError.js';

function run(err) {
  const res = {
    statusCode: undefined,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  errorHandler(err, {}, res, () => {});
  return res;
}

describe('errorHandler', () => {
  it('adds details to the body only when the error carries them', () => {
    const res = run(new AppError(409, 'IN_USE', 'In use', undefined, { productCount: 3 }));

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ message: 'In use', code: 'IN_USE', details: { productCount: 3 } });
  });

  it('keeps the body unchanged for errors without details', () => {
    expect(run(new AppError(404, 'NOT_FOUND', 'Not found')).body).toEqual({
      message: 'Not found',
      code: 'NOT_FOUND',
    });
    const withErrors = run(new AppError(400, 'VALIDATION_ERROR', 'Validation failed', { a: 'b' }));
    expect(withErrors.body).toEqual({
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: { a: 'b' },
    });
  });

  it('never includes details or internals on an unexpected error', () => {
    const err = new Error('db password is hunter2');
    err.details = { secret: true };

    const res = run(err);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ message: 'Something went wrong', code: 'INTERNAL_ERROR' });
  });
});
