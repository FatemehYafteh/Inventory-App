import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthRequest } from '../../src/models/AuthRequest.js';
import { Category } from '../../src/models/Category.js';
import { Product } from '../../src/models/Product.js';
import { StockMovement } from '../../src/models/StockMovement.js';
import { User } from '../../src/models/User.js';
import { ORIGIN, buildApp, createUser, useTestDatabase } from '../helpers/setup.js';

useTestDatabase();

const app = buildApp();

/** Who can read whose data. One admin, two staff, one active and one archived product. */
let admin;
let ana;
let ben;
let open;
let archived;

beforeEach(async () => {
  admin = await createUser({ role: 'admin', status: 'active', name: 'Ada Admin' });
  ana = await createUser({
    role: 'staff',
    status: 'active',
    name: 'Ana Staff',
    email: 'ana@example.com',
  });
  ben = await createUser({
    role: 'staff',
    status: 'active',
    name: 'Ben Staff',
    email: 'ben@example.com',
  });
  const category = await Category.create({ title: 'General' });
  const make = (sku, isArchived) =>
    Product.create({
      title: `Item ${sku}`,
      sku,
      category: category._id,
      price: 5,
      quantity: 3,
      isArchived,
    });
  open = await make('OPEN-1', false);
  archived = await make('ARCH-1', true);
  for (const product of [open, archived]) {
    await StockMovement.create({
      product: product._id,
      type: 'receive',
      quantityChange: 3,
      quantityBefore: 0,
      quantityAfter: 3,
      performedBy: admin._id,
      performedByName: admin.name,
    });
  }
});

const as = (user) => ({
  get: (path) => request(app).get(path).set('x-test-user', String(user._id)),
  patch: (path) =>
    request(app)
      .patch(path)
      .set('x-test-user', String(user._id))
      .set('Origin', ORIGIN)
      .set('X-Requested-With', 'test'),
});

describe('staff never see archived products or their history', () => {
  it('cannot open an archived product, list archived ones, or read its history', async () => {
    const staff = as(ana);
    expect((await staff.get(`/api/products/${archived._id}`)).status).toBe(404);
    expect((await staff.get('/api/products?archived=true')).status).toBe(403);
    expect((await staff.get(`/api/products/${archived._id}/movements`)).status).toBe(404);
  });

  it('the product list, movements, a movements filter on that product, and the CSV leave it out', async () => {
    const staff = as(ana);

    const list = await staff.get('/api/products');
    expect(list.body.items.map((item) => item.sku)).toEqual(['OPEN-1']);

    const movements = await staff.get('/api/movements');
    expect(movements.body.total).toBe(1);
    expect(movements.body.items[0].product.sku).toBe('OPEN-1');

    const forced = await staff.get(`/api/movements?product=${archived._id}`);
    expect(forced.status).toBe(200);
    expect(forced.body.total).toBe(0);

    const csv = await staff.get('/api/products/export');
    expect(csv.text).toContain('OPEN-1');
    expect(csv.text).not.toContain('ARCH-1');
  });

  it('an admin does see them (so the rule is about role, not about the data)', async () => {
    const boss = as(admin);
    expect((await boss.get(`/api/products/${archived._id}`)).status).toBe(200);
    expect((await boss.get('/api/movements')).body.total).toBe(2);
    expect((await boss.get(`/api/products/${archived._id}/movements`)).status).toBe(200);
  });
});

describe("one user cannot read or change another user's account", () => {
  it('/auth/me returns only the caller, and never a hash or token', async () => {
    const res = await as(ana).get('/api/auth/me');
    expect(res.body.user).toMatchObject({ id: String(ana._id), email: 'ana@example.com' });
    expect(res.text).not.toMatch(/passwordHash|argon2|refresh|token|lockedUntil|failedLogin/i);
  });

  it('staff cannot read another user, or the user list', async () => {
    expect((await as(ana).get(`/api/users/${ben._id}`)).status).toBe(403);
    expect((await as(ana).get('/api/users')).status).toBe(403);
  });

  it("the admin's user list and detail never contain password hashes or lock data", async () => {
    const list = await as(admin).get('/api/users');
    const detail = await as(admin).get(`/api/users/${ben._id}`);
    for (const res of [list, detail]) {
      expect(res.status).toBe(200);
      expect(res.text).not.toMatch(/passwordHash|\$argon2|failedLoginCount|lockedUntil/);
    }
  });

  it('a profile update changes only the caller and only name and language, whatever else is sent', async () => {
    const res = await as(ana)
      .patch('/api/auth/profile')
      .send({
        name: 'Ana Renamed',
        role: 'admin',
        status: 'active',
        email: 'evil@example.com',
        id: String(ben._id),
        _id: String(ben._id),
        passwordHash: 'x',
        telegramId: '999',
      });

    expect(res.status).toBe(200);
    const [anaAfter, benAfter] = await Promise.all([
      User.findById(ana._id),
      User.findById(ben._id),
    ]);
    expect(anaAfter).toMatchObject({
      name: 'Ana Renamed',
      role: 'staff',
      email: 'ana@example.com',
    });
    expect(anaAfter.telegramId).toBeUndefined();
    expect(benAfter).toMatchObject({ name: 'Ben Staff', role: 'staff', email: 'ben@example.com' });
  });
});

describe('a Connect Telegram request belongs to the user who started it', () => {
  const future = () => new Date(Date.now() + 60_000);

  beforeEach(async () => {
    await AuthRequest.create({
      requestId: 'connect-ana',
      purpose: 'connect',
      connectUser: ana._id,
      startTokenHash: 'hash-ana',
      status: 'otp_sent',
      telegramUsername: 'ana_tg',
      name: 'Ana From Telegram',
      lastSentAt: new Date(),
      otpExpiresAt: future(),
      expiresAt: future(),
    });
  });

  it('shows it to its owner', async () => {
    const res = await as(ana).get('/api/auth/telegram/status?requestId=connect-ana');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'otp_sent', telegramUsername: 'ana_tg' });
  });

  it('reads as expired, with none of its details, to another signed-in user', async () => {
    const res = await as(ben).get('/api/auth/telegram/status?requestId=connect-ana');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'expired' });
    expect(res.text).not.toContain('ana_tg');
  });

  it('is refused with 401 to someone who is not signed in', async () => {
    const res = await request(app).get('/api/auth/telegram/status?requestId=connect-ana');
    expect(res.status).toBe(401);
    expect(res.text).not.toContain('ana_tg');
  });
});
