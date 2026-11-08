import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../../src/middleware/error.js';

function run(err) {
  const res = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  errorHandler(err, { method: 'GET', originalUrl: '/api/x' }, res, () => {});
  return res;
}

describe('errorHandler with Mongoose errors', () => {
  it('answers 404 for a malformed id that reached a query, instead of 500', () => {
    const err = new mongoose.Error.CastError('ObjectId', 'not-an-id', '_id');

    const res = run(err);

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('answers 400 for a schema validation error', () => {
    const err = new mongoose.Error.ValidationError();

    const res = run(err);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
