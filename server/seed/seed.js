import { Category } from '../src/models/Category.js';
import { EmailToken } from '../src/models/EmailToken.js';
import { Product } from '../src/models/Product.js';
import { RefreshToken } from '../src/models/RefreshToken.js';
import { StatusChange } from '../src/models/StatusChange.js';
import { StockMovement } from '../src/models/StockMovement.js';
import { Supplier } from '../src/models/Supplier.js';
import { User, isProfileComplete } from '../src/models/User.js';
import { SYSTEM_NAME } from '../src/services/adminBootstrap.service.js';
import { hashPassword } from '../src/services/password.service.js';
import { categories } from './data/categories.js';
import { products } from './data/products.js';
import { statusChanges } from './data/statusChanges.js';
import { suppliers } from './data/suppliers.js';
import { users } from './data/users.js';

export const DEFAULT_SEED_PASSWORD = 'inventory-demo-2026';

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 30;

/** Turns 'receive 20' / 'inc' into a movement relative to the current quantity. */
export function parseStep(step, before) {
  const [type, amountText] = step.split(' ');
  const amount = Number(amountText);
  switch (type) {
    case 'receive':
      return { type: 'receive', change: amount };
    case 'ship':
      return { type: 'ship', change: -amount };
    case 'adjust':
      return { type: 'adjust', change: amount - before };
    case 'inc':
      return { type: 'increment', change: 1 };
    case 'dec':
      return { type: 'decrement', change: -1 };
    default:
      throw new Error(`Unknown seed step "${step}"`);
  }
}

function noteFor(type, index, productIndex) {
  if (index === 0) return undefined; // the initial stock carries a reason, not a note
  if (type === 'receive') return `Purchase order PO-${2400 + productIndex * 10 + index}`;
  if (type === 'ship') return `Customer order SO-${5100 + productIndex * 10 + index}`;
  if (type === 'adjust') return 'Stock count correction';
  return undefined;
}

/**
 * Replays a product's history into movements, enforcing the same rules the stock engine
 * will: positive receive/ship amounts, never below zero, no no-op adjustments.
 */
export function buildHistory(spec, { productIndex, now, performers }) {
  const start = now.getTime() - HISTORY_DAYS * DAY_MS;
  const spacing = (HISTORY_DAYS - 2) / spec.history.length;
  let quantity = 0;

  const movements = spec.history.map((step, index) => {
    const { type, change } = parseStep(step, quantity);
    const label = `${spec.sku} step ${index + 1} (${step})`;
    if (index === 0 && type !== 'receive') throw new Error(`${label}: must start with receive`);
    if ((type === 'receive' || type === 'ship') && !(Math.abs(change) > 0)) {
      throw new Error(`${label}: amount must be positive`);
    }
    if (type === 'adjust' && change === 0) throw new Error(`${label}: same as current`);
    if (quantity + change < 0) throw new Error(`${label}: would go below zero`);

    const performer = performers[(index + productIndex) % performers.length];
    const movement = {
      type,
      quantityChange: change,
      quantityBefore: quantity,
      quantityAfter: quantity + change,
      note: noteFor(type, index, productIndex),
      // The first step is the product's initial stock, marked rather than written as English text.
      ...(index === 0 && { reason: 'initial' }),
      performedBy: performer._id,
      performedByName: performer.name,
      createdAt: new Date(start + (index * spacing + 1) * DAY_MS + productIndex * 60_000),
    };
    quantity += change;
    return movement;
  });

  return { movements, quantity };
}

async function seedUsers(passwordHash, now) {
  const byKey = {};
  let created = 0;
  for (const {
    key,
    password,
    statusChangedBy,
    statusReason,
    signedUpDaysAgo,
    lastLoginDaysAgo,
    approvedBy,
    ...fields
  } of users) {
    const filter = fields.email ? { email: fields.email } : { telegramId: fields.telegramId };
    let user = await User.findOne(filter);
    if (!user) {
      user = await User.create({
        ...fields,
        passwordHash: password ? passwordHash : undefined,
        statusReason,
        statusChangedAt: fields.status === 'pending' ? undefined : new Date(now - 2 * DAY_MS),
        ...(signedUpDaysAgo && { createdAt: new Date(now - signedUpDaysAgo * DAY_MS) }),
        ...(lastLoginDaysAgo !== undefined && {
          lastLoginAt: new Date(now - lastLoginDaysAgo * DAY_MS),
        }),
      });
      created += 1;
    }
    byKey[key] = user;
    // Resolved after the referenced user exists.
    const changer = statusChangedBy ?? approvedBy;
    if (changer && !user.statusChangedBy) {
      user.statusChangedBy = byKey[changer]._id;
      await user.save();
    }
  }
  return { byKey, created };
}

/**
 * Inserts each status change once, dated `daysAgo` before `now`. A user who got new rows has
 * their `statusChangedAt` set to the date of the latest one, as a real change would.
 */
async function seedStatusChanges(usersByKey, now) {
  let created = 0;
  const latest = new Map();
  for (const { user: key, from, to, changedBy, reason, daysAgo } of statusChanges) {
    const user = usersByKey[key];
    if (!user) throw new Error(`Status change for unknown user "${key}"`);
    if (await StatusChange.exists({ user: user._id, from, to })) continue;

    const changer = changedBy ? usersByKey[changedBy] : null;
    if (changedBy && !changer) throw new Error(`Status change by unknown user "${changedBy}"`);
    const at = new Date(now - daysAgo * DAY_MS);
    await StatusChange.create({
      user: user._id,
      from,
      to,
      changedBy: changer?._id ?? null,
      changedByName: changer?.name ?? SYSTEM_NAME,
      reason,
      at,
    });
    if (!(latest.get(key) > at)) latest.set(key, at);
    created += 1;
  }
  for (const [key, at] of latest) {
    await User.updateOne({ _id: usersByKey[key]._id }, { $set: { statusChangedAt: at } });
  }
  return created;
}

async function upsertByName(Model, field, items) {
  const byName = {};
  let created = 0;
  for (const item of items) {
    const existing = await Model.findOne({ [field]: item[field] }).collation({
      locale: 'en',
      strength: 2,
    });
    byName[item[field]] = existing ?? (await Model.create(item));
    if (!existing) created += 1;
  }
  return { byName, created };
}

async function seedProducts({ categoriesByTitle, suppliersByName, performers, now }) {
  let created = 0;
  let movementCount = 0;

  for (const [productIndex, spec] of products.entries()) {
    if (await Product.exists({ sku: spec.sku.toUpperCase() })) continue;

    const category = categoriesByTitle[spec.category];
    const supplier = spec.supplier ? suppliersByName[spec.supplier] : undefined;
    if (!category) throw new Error(`${spec.sku}: unknown category "${spec.category}"`);
    if (spec.supplier && !supplier) throw new Error(`${spec.sku}: unknown supplier`);

    const { movements, quantity } = buildHistory(spec, { productIndex, now, performers });
    const first = movements[0].createdAt;
    const last = movements.at(-1).createdAt;

    // insertMany with timestamps off keeps the historical dates.
    const [product] = await Product.insertMany(
      [
        {
          title: spec.title,
          sku: spec.sku,
          description: spec.description,
          category: category._id,
          supplier: supplier?._id,
          price: spec.price,
          quantity,
          reorderLevel: spec.reorderLevel,
          isArchived: Boolean(spec.isArchived),
          archivedAt: spec.isArchived ? new Date(last.getTime() + DAY_MS) : undefined,
          createdAt: first,
          updatedAt: last,
        },
      ],
      { timestamps: false },
    );

    await StockMovement.insertMany(
      movements.map((movement) => ({
        ...movement,
        product: product._id,
        // A receive records the product's supplier at that moment.
        supplier: movement.type === 'receive' ? supplier?._id : undefined,
      })),
      { timestamps: false },
    );

    created += 1;
    movementCount += movements.length;
  }

  return { created, movementCount };
}

/**
 * Seeds every collection with realistic data that follows the PRD rules.
 * Safe to run repeatedly: existing records (matched by email, title, name or SKU) are kept,
 * so only missing data is added. `reset: true` wipes the seeded collections first.
 */
export async function seedDatabase({
  reset = false,
  password = DEFAULT_SEED_PASSWORD,
  now = new Date(),
} = {}) {
  if (reset) {
    await Promise.all(
      [
        StockMovement,
        Product,
        Supplier,
        Category,
        EmailToken,
        RefreshToken,
        StatusChange,
        User,
      ].map((Model) => Model.deleteMany({})),
    );
  }
  await Promise.all(
    [User, StatusChange, Category, Supplier, Product, StockMovement, EmailToken, RefreshToken].map(
      (Model) => Model.init(),
    ),
  );

  const passwordHash = await hashPassword(password);
  const { byKey: usersByKey, created: usersCreated } = await seedUsers(passwordHash, now);
  const statusChangesCreated = await seedStatusChanges(usersByKey, now);
  // Only active, profile-complete users can change stock (PRD section 7).
  const performers = [usersByKey.admin, usersByKey.staff, usersByKey.staff2];
  const catalog = await seedCatalog({ performers, now });

  return {
    users: usersCreated,
    statusChanges: statusChangesCreated,
    categories: catalog.categories,
    suppliers: catalog.suppliers,
    products: catalog.products,
    movements: catalog.movements,
  };
}

/** Categories, suppliers, products and their stock history; shared by the seed and the demo reset. */
async function seedCatalog({ performers, now }) {
  const { byName: categoriesByTitle, created: categoriesCreated } = await upsertByName(
    Category,
    'title',
    categories,
  );
  const { byName: suppliersByName, created: suppliersCreated } = await upsertByName(
    Supplier,
    'name',
    suppliers,
  );
  const { created: productsCreated, movementCount } = await seedProducts({
    categoriesByTitle,
    suppliersByName,
    performers,
    now,
  });
  return {
    categories: categoriesCreated,
    suppliers: suppliersCreated,
    products: productsCreated,
    movements: movementCount,
  };
}

/**
 * Deletes and reseeds only the demo catalog: products, stock movements, categories and
 * suppliers. Every user, session (refresh tokens), email token and status change is kept as it
 * is, and no user is created, so real accounts and logins survive. The stock history is
 * attributed to existing active users with a complete profile (admins first, up to three); with
 * none it stops before deleting anything.
 */
export async function resetDemoData({ now = new Date() } = {}) {
  const candidates = await User.find({ status: 'active' }).sort({ role: 1, createdAt: 1 });
  const performers = candidates.filter((user) => isProfileComplete(user)).slice(0, 3);
  if (performers.length === 0) {
    throw new Error(
      'No active user with a complete profile to attribute the stock history to. Nothing was changed.',
    );
  }

  await Promise.all(
    [StockMovement, Product, Supplier, Category].map((Model) => Model.deleteMany({})),
  );
  await Promise.all([Category, Supplier, Product, StockMovement].map((Model) => Model.init()));
  const created = await seedCatalog({ performers, now });
  return { ...created, usersKept: await User.countDocuments() };
}
