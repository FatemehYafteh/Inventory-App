import { MESSAGES } from '@inventory/shared/errorCodes';
import * as schemas from '@inventory/shared/schemas';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorHandler } from '../../src/middleware/error.js';
import { validate } from '../../src/middleware/validate.js';
import { AppError } from '../../src/utils/AppError.js';
import { ORIGIN, buildApp, createUser, useTestDatabase } from '../helpers/setup.js';

useTestDatabase();

function post(app, path, body, actor) {
  const req = request(app)
    .post(path)
    .set('Origin', ORIGIN)
    .set('X-Requested-With', 'XMLHttpRequest');
  if (actor) req.set('x-test-user', actor.id);
  return req.send(body);
}

function runHandler(err) {
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
  errorHandler(err, {}, res, () => {});
  return res;
}

/** Runs the validate middleware and returns the AppError it passes on. */
function validationOf(schema, body) {
  let result;
  validate(schema)({ body }, {}, (err) => {
    result = err;
  });
  return result;
}

describe('validation error codes over HTTP', () => {
  it('adds errorCodes next to errors on register', async () => {
    const res = await post(
      buildApp(),
      '/api/auth/register',
      {
        name: 'Nora',
        email: 'not-an-email',
        password: 'short',
        confirmPassword: 'other',
      },
      undefined,
      true,
    );

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.errors).toEqual({
      email: 'Enter a valid email address',
      password: 'Password must be at least 10 characters',
      confirmPassword: 'Passwords do not match',
    });
    expect(res.body.errorCodes).toEqual({
      email: 'EMAIL_INVALID',
      password: 'PASSWORD_TOO_SHORT',
      confirmPassword: 'PASSWORDS_DO_NOT_MATCH',
    });
  });

  it('adds errorCodes on product create with a missing title', async () => {
    const admin = await createUser({ role: 'admin' });
    const res = await post(buildApp(), '/api/products', { sku: 'A-1', price: 1 }, admin);

    expect(res.status).toBe(400);
    expect(res.body.errors.title).toBe('Enter a title');
    expect(res.body.errorCodes.title).toBe('TITLE_REQUIRED');
    expect(Object.keys(res.body.errorCodes)).toEqual(Object.keys(res.body.errors));
  });
});

describe('validate middleware', () => {
  it('reports a message outside the catalogue as VALIDATION_INVALID and keeps its text', () => {
    const err = validationOf(z.object({ age: z.number() }), { age: 'x' });

    expect(err.errors.age).toBe('Expected number, received string');
    expect(err.errorCodes).toEqual({ age: 'VALIDATION_INVALID' });
    expect(MESSAGES.VALIDATION_INVALID).toBeTruthy();
  });

  it('reports a Zod default such as Required as VALIDATION_INVALID', () => {
    const err = validationOf(z.object({ a: z.string() }), {});

    expect(err.errors).toEqual({ a: 'Required' });
    expect(err.errorCodes).toEqual({ a: 'VALIDATION_INVALID' });
  });

  it('maps every catalogued schema message back to its code', () => {
    const cases = [
      [schemas.loginSchema, {}, { email: 'EMAIL_REQUIRED', password: 'PASSWORD_REQUIRED' }],
      [schemas.createCategorySchema, { title: '' }, { title: 'TITLE_REQUIRED' }],
      [schemas.createSupplierSchema, {}, { name: 'SUPPLIER_NAME_REQUIRED' }],
      [schemas.stockChangeSchema, { type: 'receive' }, { quantity: 'QUANTITY_REQUIRED' }],
      [schemas.changeRoleSchema, { role: 'x' }, { role: 'ROLE_INVALID' }],
      [schemas.changeStatusSchema, { status: 'x' }, { status: 'STATUS_INVALID' }],
      [
        schemas.createSupplierSchema,
        { name: 'A', phone: 'p'.repeat(41) },
        { phone: 'PHONE_TOO_LONG' },
      ],
      [schemas.updateCategorySchema, {}, { _: 'NOTHING_TO_UPDATE' }],
    ];
    for (const [schema, body, expected] of cases) {
      expect(validationOf(schema, body).errorCodes).toEqual(expected);
    }
  });
});

describe('errorHandler body', () => {
  it('does not add a messageCode: the body keeps its existing shape', () => {
    expect(runHandler(new AppError(404, 'NOT_FOUND', 'Product not found')).body).toEqual({
      message: 'Product not found',
      code: 'NOT_FOUND',
    });
  });

  it('adds errorCodes only when the error carries them', () => {
    const err = new AppError(400, 'VALIDATION_ERROR', 'Validation failed', { a: 'x' }, undefined, {
      a: 'VALIDATION_INVALID',
    });

    expect(runHandler(err).body.errorCodes).toEqual({ a: 'VALIDATION_INVALID' });
  });

  it('keeps the body of errors without extras unchanged', () => {
    expect(runHandler(new AppError(418, 'TEAPOT', 'Short and stout')).body).toEqual({
      message: 'Short and stout',
      code: 'TEAPOT',
    });
    expect(runHandler(new Error('boom')).body).toEqual({
      message: 'Something went wrong',
      code: 'INTERNAL_ERROR',
    });
  });
});
