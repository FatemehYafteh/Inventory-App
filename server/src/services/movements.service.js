import { Product } from '../models/Product.js';
import { StockMovement } from '../models/StockMovement.js';

/**
 * The Mongo filter for the movement filters. Staff never see movements of archived products
 * (plan decision D1), so for them those products are excluded however the filters combine.
 */
async function filterFor(user, { product, type, supplier, user: performer, from, to }) {
  const filter = {};
  if (type) filter.type = type;
  if (supplier) filter.supplier = supplier;
  if (performer) filter.performedBy = performer;
  if (from) filter.createdAt = { $gte: from, ...(to && { $lt: to }) };
  if (user.role !== 'admin') {
    const archived = await Product.find({ isArchived: true }).distinct('_id');
    if (archived.length) filter.product = { $nin: archived };
  }
  if (product) filter.product = { ...filter.product, $eq: product };
  return filter;
}

function withRelations(query) {
  return query
    .populate('product', 'title sku')
    .populate('supplier', 'name')
    .populate('performedBy', 'role');
}

function present(movement) {
  const { product, supplier, performedBy } = movement;
  return {
    id: movement.id,
    product: product && { id: product.id, title: product.title, sku: product.sku },
    type: movement.type,
    quantityChange: movement.quantityChange,
    quantityBefore: movement.quantityBefore,
    quantityAfter: movement.quantityAfter,
    supplier: supplier?.name ? { id: supplier.id, name: supplier.name } : null,
    note: movement.note ?? '',
    // The name is the one stored with the movement; the role is the user's current role.
    performedBy: {
      id: String(performedBy?._id ?? performedBy),
      name: movement.performedByName,
      role: performedBy?.role ?? null,
    },
    createdAt: movement.createdAt,
  };
}

/** One page of all movements, newest first (the id breaks ties so pages never repeat). */
export async function listAllMovements(user, query) {
  const { page, limit } = query;
  const filter = await filterFor(user, query);
  const [movements, total] = await Promise.all([
    withRelations(
      StockMovement.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ),
    StockMovement.countDocuments(filter),
  ]);
  return { items: movements.map(present), total, page, limit };
}

/** Every movement matching the filters, newest first, as a database cursor of presented rows. */
export async function* streamMovements(user, query) {
  const filter = await filterFor(user, query);
  const cursor = withRelations(
    StockMovement.find(filter).sort({ createdAt: -1, _id: -1 }),
  ).cursor();
  for await (const movement of cursor) yield present(movement);
}

/**
 * Everyone who has made a movement the caller may see, as `{ id, name }` by name, for the
 * "performed by" filter. Staff cannot list users, so this comes from the movements themselves.
 */
export async function listPerformers(user) {
  const filter = await filterFor(user, {});
  const rows = await StockMovement.aggregate([
    { $match: filter },
    { $sort: { createdAt: -1, _id: -1 } },
    { $group: { _id: '$performedBy', name: { $first: '$performedByName' } } },
    { $sort: { name: 1, _id: 1 } },
  ]);
  return { items: rows.map((row) => ({ id: String(row._id), name: row.name })) };
}
