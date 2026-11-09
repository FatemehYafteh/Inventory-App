import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Category } from '../../src/models/Category.js';
import { Product } from '../../src/models/Product.js';
import { buildApp, createUser, ORIGIN, useTestDatabase } from '../helpers/setup.js';

useTestDatabase();

const app = buildApp();
const ID = '64b000000000000000000000';

// Every data route with the lowest role that may call it.
const ANY_ACTIVE = [
  ['get', '/api/products'],
  ['get', '/api/products/export'],
  ['get', `/api/products/${ID}`],
  ['get', `/api/products/${ID}/movements`],
  ['get', '/api/movements'],
  ['get', '/api/movements/performers'],
  ['get', '/api/categories'],
  ['get', '/api/suppliers'],
  ['get', '/api/dashboard'],
];
const EDITOR = [
  ['post', '/api/products'],
  ['patch', `/api/products/${ID}`],
  ['post', `/api/products/${ID}/stock`],
];
const ADMIN_ONLY = [
  ['patch', `/api/products/${ID}/archive`],
  ['patch', `/api/products/${ID}/restore`],
  ['post', '/api/categories'],
  ['patch', `/api/categories/${ID}`],
  ['delete', `/api/categories/${ID}`],
  ['post', '/api/suppliers'],
  ['patch', `/api/suppliers/${ID}`],
  ['delete', `/api/suppliers/${ID}`],
  ['get', '/api/users'],
  ['get', '/api/users/pending-count'],
  ['get', `/api/users/${ID}`],
  ['patch', `/api/users/${ID}/status`],
  ['patch', `/api/users/${ID}/role`],
];

/** A request that passes the CSRF checks, so a refusal can only come from the access gates. */
const call = (method, path, user) => {
  const req = request(app)[method](path).set('Origin', ORIGIN).set('X-Requested-With', 'test');
  return user ? req.set('x-test-user', String(user._id)) : req;
};

const label = ([method, path]) => `${method.toUpperCase()} ${path.replace(ID, ':id')}`;

describe('access gates, swept over every data route', () => {
  it.each([...ANY_ACTIVE, ...EDITOR, ...ADMIN_ONLY].map((r) => [label(r), ...r]))(
    '%s refuses a request with no session (401)',
    async (_name, method, path) => {
      const res = await call(method, path);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('NOT_AUTHENTICATED');
    },
  );

  it.each([...ANY_ACTIVE, ...EDITOR, ...ADMIN_ONLY].map((r) => [label(r), ...r]))(
    '%s refuses a pending user (403)',
    async (_name, method, path) => {
      const pending = await createUser({ status: 'pending' });
      const res = await call(method, path, pending);
      expect(res.status).toBe(403);
    },
  );

  it.each(ADMIN_ONLY.map((r) => [label(r), ...r]))(
    '%s refuses an active staff user (403 FORBIDDEN)',
    async (_name, method, path) => {
      const staff = await createUser({ role: 'staff', status: 'active' });
      const res = await call(method, path, staff);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    },
  );

  it('rejects a forged x-test-user header outside the test environment', async () => {
    const { loadConfig } = await import('../../src/config/env.js');
    const { createApp } = await import('../../src/app.js');
    const { testEnv } = await import('../helpers/setup.js');
    const admin = await createUser({ role: 'admin', status: 'active' });
    const dev = createApp(loadConfig({ ...testEnv, NODE_ENV: 'development' }));

    const res = await request(dev)
      .get('/api/users')
      .set('Origin', ORIGIN)
      .set('X-Requested-With', 'test')
      .set('x-test-user', String(admin._id));

    expect(res.status).toBe(401);
  });
});

describe('CSRF checks on state-changing requests', () => {
  it('refuses a write with no X-Requested-With header', async () => {
    const admin = await createUser({ role: 'admin', status: 'active' });
    const res = await request(app)
      .post('/api/categories')
      .set('Origin', ORIGIN)
      .set('x-test-user', String(admin._id))
      .send({ title: 'Tools' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF_REJECTED');
  });

  it('refuses a write from a foreign Origin', async () => {
    const admin = await createUser({ role: 'admin', status: 'active' });
    const res = await request(app)
      .post('/api/categories')
      .set('Origin', 'https://evil.example')
      .set('X-Requested-With', 'test')
      .set('x-test-user', String(admin._id))
      .send({ title: 'Tools' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF_REJECTED');
  });
});

describe('operator injection in queries and bodies', () => {
  // Express 5 reads `search[$ne]=Alpha` as one flat key, not as { $ne: 'Alpha' }, so the operator
  // is ignored and never reaches MongoDB. If it did, `$ne: 'Alpha'` would hide Alpha (total 1).
  it.each([
    ['search[$ne]=Alpha'],
    ['search[$regex]=.*'],
    ['category[$ne]=x'],
    ['supplier[$gt]='],
    ['status[$ne]=in_stock'],
    ['page[$gt]=0'],
  ])(
    'GET /api/products?%s is ignored as a plain unknown key, never applied as an operator',
    async (query) => {
      const staff = await createUser({ role: 'staff', status: 'active' });
      const category = await Category.create({ title: 'General' });
      await Product.create({ title: 'Alpha', sku: 'A1', category: category._id, price: 1 });
      await Product.create({ title: 'Beta', sku: 'B1', category: category._id, price: 1 });

      const plain = await call('get', '/api/products?search=Alpha', staff);
      const res = await call('get', `/api/products?${query}`, staff);

      expect(plain.body.total).toBe(1); // the filter machinery works
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2); // the operator filtered nothing
    },
  );

  it('refuses an unknown sort field such as $where with 400', async () => {
    const staff = await createUser({ role: 'staff', status: 'active' });
    const res = await call('get', '/api/products?sortBy=$where', staff);
    expect(res.status).toBe(400);
  });

  it('a login body of {"$ne": null} operators does not sign anyone in', async () => {
    await createUser({ email: 'real@example.com', status: 'active' });
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', ORIGIN)
      .set('X-Requested-With', 'test')
      .send({ email: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('a stock change cannot smuggle operators or another performer', async () => {
    const staff = await createUser({ role: 'staff', status: 'active' });
    const res = await call('post', `/api/products/${ID}/stock`, staff).send({
      type: { $ne: 'x' },
      quantity: { $gt: 0 },
    });
    expect(res.status).toBe(400);
  });
});
