import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { Product } from '../../src/models/Product.js';
import { StockMovement } from '../../src/models/StockMovement.js';
import { createUser } from '../helpers/setup.js';

/**
 * End to end: the real server process (`node src/index.js`), real HTTP with cookies, and a real
 * MongoDB replica set. A TCP proxy sits between the server and the database so the test can cut
 * the database off mid-run and bring it back, which a mongoose-level test cannot do honestly.
 */

const SERVER_DIR = fileURLToPath(new URL('../..', import.meta.url));
const ORIGIN = 'http://127.0.0.1:5173';
const ADMIN_PASSWORD = 'correct-horse-battery';

const freePort = () =>
  new Promise((resolve) => {
    const probe = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

/** A TCP forwarder to the database that can be switched off and on. */
function createProxy(targetHost, targetPort) {
  const sockets = new Set();
  let server;
  let port;
  const handle = (client) => {
    const upstream = net.connect(targetPort, targetHost);
    for (const socket of [client, upstream]) {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
      socket.on('error', () => socket.destroy());
    }
    client.pipe(upstream).pipe(client);
  };
  return {
    get port() {
      return port;
    },
    async start() {
      port ??= await freePort();
      server = net.createServer(handle);
      await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
    },
    async stop() {
      // Cut the open connections first: close() only finishes once they are gone.
      const closed = new Promise((resolve) => server.close(resolve));
      for (const socket of sockets) socket.destroy();
      await closed;
    },
  };
}

let proxy;
let child;
let childLog = '';
let base;
let dbName;
const jar = new Map();

async function bootServer() {
  const [host, port] = new URL(inject('mongoUri').replace('mongodb://', 'http://')).host.split(':');
  proxy = createProxy(host, Number(port));
  await proxy.start();
  dbName = `it_${randomUUID()}`;
  const serverPort = await freePort();
  base = `http://127.0.0.1:${serverPort}`;

  child = spawn(process.execPath, ['src/index.js'], {
    cwd: SERVER_DIR,
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      NODE_ENV: 'development',
      PORT: String(serverPort),
      // directConnection skips replica-set discovery, so every connection goes through the proxy.
      MONGODB_URI: `mongodb://127.0.0.1:${proxy.port}/${dbName}?directConnection=true`,
      MONGO_SERVER_SELECTION_TIMEOUT_MS: '2000',
      JWT_ACCESS_SECRET: 'integration-access-secret-integration-access',
      JWT_REFRESH_SECRET: 'integration-refresh-secret-integration-refresh',
      CLIENT_ORIGIN: ORIGIN,
      APP_URL: ORIGIN,
      RATE_LIMIT_STORE: 'memory',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', (chunk) => {
      childLog += chunk;
    });
  }
  const deadline = Date.now() + 30_000;
  while (!childLog.includes('API listening')) {
    if (child.exitCode !== null) throw new Error(`Server exited early:\n${childLog}`);
    if (Date.now() > deadline) throw new Error(`Server did not start:\n${childLog}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** One HTTP call with the cookie jar, as a browser behind the Vite proxy would make it. */
async function call(method, path, body, { headers = {}, cookies = true, timeoutMs = 45_000 } = {}) {
  const sendHeaders = { Origin: ORIGIN, 'X-Requested-With': 'XMLHttpRequest', ...headers };
  if (body !== undefined) sendHeaders['Content-Type'] = 'application/json';
  if (cookies && jar.size) {
    sendHeaders.Cookie = [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
  }
  const started = Date.now();
  let res;
  try {
    res = await fetch(`${base}${path}`, {
      method,
      headers: sendHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    // A request that never answered: status 0, so a test can report how long it hung.
    return {
      status: 0,
      headers: new Headers(),
      text: String(error),
      json: undefined,
      ms: Date.now() - started,
    };
  }
  for (const line of res.headers.getSetCookie()) {
    const [pair] = line.split(';');
    const index = pair.indexOf('=');
    const name = pair.slice(0, index);
    const value = pair.slice(index + 1);
    if (value) jar.set(name, value);
    else jar.delete(name);
  }
  // Decode the raw bytes: fetch's own text() would strip a leading byte-order mark.
  const text = Buffer.from(await res.arrayBuffer()).toString('utf8');
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: res.status, headers: res.headers, text, json, ms: Date.now() - started };
}

beforeAll(async () => {
  await mongoose.connect(inject('mongoUri'), { dbName: 'unused_placeholder' });
  await bootServer();
  // The test talks to the same database the server uses, through the same proxy.
  await mongoose.disconnect();
  await mongoose.connect(`mongodb://127.0.0.1:${proxy.port}/${dbName}?directConnection=true`);
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}, 120_000);

afterAll(async () => {
  child?.kill();
  await mongoose.disconnect().catch(() => {});
  await proxy?.stop().catch(() => {});
});

describe('live server: the API over real HTTP and a real database', () => {
  const ids = {};

  it('answers the health check and an unknown route as JSON', async () => {
    const health = await call('get', '/api/health');
    expect(health.status).toBe(200);
    expect(health.json).toEqual({ status: 'ok' });

    const missing = await call('get', '/api/nope');
    expect(missing.status).toBe(404);
    expect(missing.json.code).toBe('NOT_FOUND');
  });

  it('sets security headers and no X-Powered-By', async () => {
    const res = await call('get', '/api/health');
    expect(res.headers.get('x-powered-by')).toBeNull();
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('signs in with a real password hash, sets HttpOnly SameSite=Strict cookies, no token in the body', async () => {
    await createUser({
      email: 'admin@example.com',
      name: 'Ada Admin',
      role: 'admin',
      status: 'active',
      password: ADMIN_PASSWORD,
    });

    const res = await call('post', '/api/auth/login', {
      email: 'admin@example.com',
      password: ADMIN_PASSWORD,
    });

    expect(res.status).toBe(200);
    const cookies = res.headers.getSetCookie().join('\n').toLowerCase();
    expect(cookies).toContain('access_token=');
    expect(cookies).toContain('refresh_token=');
    expect(cookies).toContain('httponly');
    expect(cookies).toContain('samesite=strict');
    expect(res.text).not.toContain(jar.get('access_token'));
    expect(res.text).not.toContain(jar.get('refresh_token'));
  });

  it('knows who is signed in', async () => {
    const res = await call('get', '/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.json.user).toMatchObject({ email: 'admin@example.com', role: 'admin' });
  });

  it('creates a category, a supplier and a product with initial stock, and reads them back', async () => {
    const category = await call('post', '/api/categories', { title: 'Hardware' });
    expect(category.status).toBe(201);
    ids.category = category.json.category.id;

    const supplier = await call('post', '/api/suppliers', { name: 'Acme Supply' });
    expect(supplier.status).toBe(201);
    ids.supplier = supplier.json.supplier.id;

    const created = await call('post', '/api/products', {
      title: 'Hammer',
      sku: 'ham-1',
      category: ids.category,
      supplier: ids.supplier,
      price: 12.5,
      reorderLevel: 3,
      initialQuantity: 5,
    });
    expect(created.status).toBe(201);
    ids.product = created.json.product.id;
    expect(created.json.product).toMatchObject({ sku: 'HAM-1', quantity: 5 });

    const read = await call('get', `/api/products/${ids.product}`);
    expect(read.json.product).toMatchObject({ title: 'Hammer', quantity: 5 });
  });

  it('applies stock changes in order, refuses an overdraw, and the history adds up', async () => {
    const stock = (body) => call('post', `/api/products/${ids.product}/stock`, body);

    expect((await stock({ type: 'receive', quantity: 10 })).json.product.quantity).toBe(15);
    const overdraw = await stock({ type: 'ship', quantity: 20 });
    expect(overdraw.status).toBe(400);
    expect(overdraw.json.code).toBe('INSUFFICIENT_STOCK');
    expect((await stock({ type: 'ship', quantity: 3 })).json.product.quantity).toBe(12);
    expect((await stock({ type: 'adjust', quantity: 7 })).json.product.quantity).toBe(7);

    const history = await call('get', `/api/products/${ids.product}/movements?limit=100`);
    expect(history.status).toBe(200);
    expect(history.json.total).toBe(4); // initial, receive, ship, adjust. The refused ship wrote nothing.
  });

  it('round trip: what the API wrote is in the database, and a direct database edit shows in the API', async () => {
    const stored = await Product.findById(ids.product);
    expect(stored).toMatchObject({ sku: 'HAM-1', quantity: 7, price: 12.5 });
    expect(String(stored.supplier)).toBe(ids.supplier);

    const movements = await StockMovement.find({ product: ids.product }).sort({
      createdAt: 1,
      _id: 1,
    });
    expect(movements.map((movement) => movement.type)).toEqual([
      'receive',
      'receive',
      'ship',
      'adjust',
    ]);
    // Each movement starts where the previous one ended, and the last one ends at the quantity.
    movements.reduce((expected, movement) => {
      expect(movement.quantityBefore).toBe(expected);
      expect(movement.quantityAfter).toBe(expected + movement.quantityChange);
      return movement.quantityAfter;
    }, 0);
    expect(movements.at(-1).quantityAfter).toBe(stored.quantity);
    expect(movements.every((movement) => movement.performedByName === 'Ada Admin')).toBe(true);

    await Product.updateOne({ _id: ids.product }, { title: 'Hammer (edited in the database)' });
    const read = await call('get', `/api/products/${ids.product}`);
    expect(read.json.product.title).toBe('Hammer (edited in the database)');
  });

  it('lists, searches, exports and summarises the same data', async () => {
    const list = await call('get', '/api/products?search=ham');
    expect(list.json.total).toBe(1);
    expect(list.json.items[0].sku).toBe('HAM-1');

    const csv = await call('get', '/api/products/export');
    expect(csv.status).toBe(200);
    expect(csv.headers.get('content-type')).toContain('text/csv');
    expect(csv.text.startsWith('﻿')).toBe(true);
    expect(csv.text).toContain('HAM-1');

    const dashboard = await call('get', '/api/dashboard');
    expect(dashboard.status).toBe(200);
  });

  it('never lets parallel ships take stock below zero over real HTTP', async () => {
    const product = await call('post', '/api/products', {
      title: 'Race',
      sku: 'race-1',
      category: ids.category,
      price: 1,
      initialQuantity: 10,
    });
    const id = product.json.product.id;

    const results = await Promise.all(
      Array.from({ length: 25 }, () =>
        call('post', `/api/products/${id}/stock`, { type: 'ship', quantity: 1 }),
      ),
    );

    expect(results.filter((r) => r.status === 201)).toHaveLength(10);
    expect(results.filter((r) => r.status === 400)).toHaveLength(15);
    expect((await Product.findById(id)).quantity).toBe(0);
    expect(await StockMovement.countDocuments({ product: id, type: 'ship' })).toBe(10);
  });

  it('returns field-level validation errors and refuses a write without the CSRF header', async () => {
    const invalid = await call('post', '/api/products', { title: '', sku: '', price: -1 });
    expect(invalid.status).toBe(400);
    expect(invalid.json.errors).toBeTruthy();
    expect(JSON.stringify(invalid.json)).not.toMatch(/at .*\.js|node_modules/);

    const noCsrf = await call(
      'post',
      '/api/categories',
      { title: 'X' },
      {
        headers: { 'X-Requested-With': '' },
      },
    );
    expect(noCsrf.status).toBe(403);
  });

  it('rotates the refresh token and signs out', async () => {
    const before = jar.get('refresh_token');
    expect((await call('post', '/api/auth/refresh')).status).toBe(204);
    expect(jar.get('refresh_token')).not.toBe(before);

    expect((await call('post', '/api/auth/logout')).status).toBe(204);
    expect((await call('get', '/api/auth/me')).status).toBe(401);
  });
});

describe('live server: the database goes down and comes back', () => {
  it('signs in again for the outage tests', async () => {
    const res = await call('post', '/api/auth/login', {
      email: 'admin@example.com',
      password: ADMIN_PASSWORD,
    });
    expect(res.status).toBe(200);
  });

  it('while the database is down: a clean 503 with a stable code, no internals, and a bounded wait', async () => {
    await proxy.stop();

    const read = await call('get', '/api/products');
    const write = await call('post', '/api/categories', { title: 'During outage' });

    for (const [label, res] of [
      ['read', read],
      ['write', write],
    ]) {
      const note = `${label}: status ${res.status} after ${res.ms} ms, body ${res.text.slice(0, 160)}`;
      expect(res.status, note).toBe(503);
      expect(res.json?.code, note).toBe('SERVICE_UNAVAILABLE');
      expect(res.text, note).not.toMatch(
        /Mongo|mongoose|ECONNREFUSED|127\.0\.0\.1|at .*\.js|stack/i,
      );
      expect(res.ms, note).toBeLessThan(15_000);
    }
  }, 120_000);

  it('the health check still answers while the database is down (the process is alive)', async () => {
    const res = await call('get', '/api/health');
    expect(res.status).toBe(200);
  });

  it('the server process survives the outage', () => {
    expect(child.exitCode).toBeNull();
  });

  it('recovers by itself when the database returns, with no restart and no half-written data', async () => {
    await proxy.start();

    let recovered;
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      recovered = await call('get', '/api/products');
      if (recovered.status === 200) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    expect(recovered.status).toBe(200);
    expect(child.exitCode).toBeNull();
    // The write attempted during the outage did not land.
    expect(
      await mongoose.connection.db
        .collection('categories')
        .countDocuments({ title: 'During outage' }),
    ).toBe(0);
    // And the server writes again.
    const write = await call('post', '/api/categories', { title: 'After outage' });
    expect(write.status).toBe(201);
  }, 90_000);
});
