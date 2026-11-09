import { describe, expect, it } from 'vitest';
import { errorHandler } from '../../src/middleware/error.js';

function run(err) {
  const res = {
    headers: {},
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
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

const named = (name, message = 'internal detail 127.0.0.1:27017') =>
  Object.assign(new Error(message), { name });

describe('errorHandler when the database cannot be reached', () => {
  it.each([
    'MongoServerSelectionError',
    'MongooseServerSelectionError',
    'MongoNetworkError',
    'MongoNetworkTimeoutError',
    'MongoNotConnectedError',
    'MongoPoolClearedError',
    'MongoPoolClosedError',
    'MongoTopologyClosedError',
  ])('answers 503 SERVICE_UNAVAILABLE for %s, with Retry-After and no internals', (name) => {
    const res = run(named(name));

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ message: 'Service unavailable', code: 'SERVICE_UNAVAILABLE' });
    expect(res.headers['Retry-After']).toBe('5');
    expect(JSON.stringify(res.body)).not.toContain('127.0.0.1');
  });

  it('answers 503 for a Mongoose command that timed out waiting for a connection', () => {
    const res = run(
      named('MongooseError', 'Operation `users.findOne()` buffering timed out after 10000ms'),
    );
    expect(res.statusCode).toBe(503);
  });

  it('still answers 500 for an ordinary unexpected error', () => {
    const res = run(new Error('boom'));
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ message: 'Something went wrong', code: 'INTERNAL_ERROR' });
    expect(res.headers['Retry-After']).toBeUndefined();
  });
});
