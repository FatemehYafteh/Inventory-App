import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { StockMovement } from '../models/StockMovement.js';
import { Supplier } from '../models/Supplier.js';
import { AppError } from '../utils/AppError.js';

const CASE_INSENSITIVE = { locale: 'en', strength: 2 };
const OPTIONAL_FIELDS = ['contactPerson', 'phone', 'email', 'address', 'notes'];

function notFound() {
  return new AppError(404, 'NOT_FOUND', 'Supplier not found');
}

function duplicateName() {
  return new AppError(409, 'DUPLICATE_NAME', 'A supplier with this name already exists', {
    name: 'A supplier with this name already exists',
  });
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function filterFor({ search, active }) {
  const filter = {};
  if (active !== undefined) filter.isActive = active;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { name: pattern },
      { contactPerson: pattern },
      { phone: pattern },
      { email: pattern },
    ];
  }
  return filter;
}

/** Documents per supplier in `model` (products include archived ones), in one grouped query. */
async function countsBySupplier(model, ids, session) {
  const rows = await model
    .aggregate([
      { $match: { supplier: { $in: ids } } },
      { $group: { _id: '$supplier', count: { $sum: 1 } } },
    ])
    .session(session ?? null);
  return new Map(rows.map((row) => [String(row._id), row.count]));
}

async function usageCounts(ids) {
  const [products, movements] = await Promise.all([
    countsBySupplier(Product, ids),
    countsBySupplier(StockMovement, ids),
  ]);
  return { products, movements };
}

function present(supplier, usage) {
  return {
    id: supplier.id,
    name: supplier.name,
    contactPerson: supplier.contactPerson ?? '',
    phone: supplier.phone ?? '',
    email: supplier.email ?? '',
    address: supplier.address ?? '',
    notes: supplier.notes ?? '',
    isActive: supplier.isActive,
    productCount: usage.products.get(supplier.id) ?? 0,
    movementCount: usage.movements.get(supplier.id) ?? 0,
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt,
  };
}

async function presentOne(supplier) {
  return present(supplier, await usageCounts([supplier._id]));
}

/** One page of suppliers with their product and movement counts. */
export async function listSuppliers(query) {
  const { page, limit, order } = query;
  const filter = filterFor(query);
  const [suppliers, total] = await Promise.all([
    Supplier.find(filter)
      .collation(CASE_INSENSITIVE)
      .sort({ name: order === 'desc' ? -1 : 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Supplier.countDocuments(filter),
  ]);
  const usage = await usageCounts(suppliers.map((supplier) => supplier._id));
  return { items: suppliers.map((supplier) => present(supplier, usage)), total, page, limit };
}

export async function createSupplier(fields) {
  const { name, ...optional } = fields;
  const values = Object.fromEntries(
    OPTIONAL_FIELDS.filter((key) => optional[key]).map((key) => [key, optional[key]]),
  );
  try {
    const supplier = await Supplier.create({ name, ...values });
    return await presentOne(supplier);
  } catch (error) {
    if (error?.code === 11000) throw duplicateName();
    throw error;
  }
}

/** An empty string clears an optional field; an inactive supplier stays editable. */
export async function updateSupplier(id, fields) {
  if (!mongoose.isValidObjectId(id)) throw notFound();
  const supplier = await Supplier.findById(id);
  if (!supplier) throw notFound();
  if (fields.name !== undefined) supplier.name = fields.name;
  if (fields.isActive !== undefined) supplier.isActive = fields.isActive;
  for (const key of OPTIONAL_FIELDS) {
    if (fields[key] !== undefined) supplier[key] = fields[key] || undefined;
  }
  try {
    await supplier.save();
  } catch (error) {
    if (error?.code === 11000) throw duplicateName();
    throw error;
  }
  return presentOne(supplier);
}

function inUseMessage(productCount, movementCount) {
  const parts = [];
  if (productCount > 0)
    parts.push(`${productCount} ${productCount === 1 ? 'product' : 'products'}`);
  if (movementCount > 0) {
    parts.push(`${movementCount} stock ${movementCount === 1 ? 'movement' : 'movements'}`);
  }
  return `Used by ${parts.join(' and ')}. Deactivate it instead.`;
}

/**
 * Counts the products (archived included) and stock movements and deletes in one transaction.
 * Product create and update write the supplier document in their own transaction
 * (products.service.js), so a product being assigned to this supplier at the same moment
 * conflicts with this delete: either the delete retries and reports IN_USE, or the product
 * write is refused.
 */
export async function deleteSupplier(id) {
  if (!mongoose.isValidObjectId(id)) throw notFound();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const supplier = await Supplier.findById(id).session(session);
      if (!supplier) throw notFound();
      const [productCount, movementCount] = await Promise.all([
        Product.countDocuments({ supplier: supplier._id }).session(session),
        StockMovement.countDocuments({ supplier: supplier._id }).session(session),
      ]);
      if (productCount > 0 || movementCount > 0) {
        throw new AppError(409, 'IN_USE', inUseMessage(productCount, movementCount), undefined, {
          productCount,
          movementCount,
        });
      }
      await Supplier.deleteOne({ _id: supplier._id }).session(session);
    });
  } finally {
    await session.endSession();
  }
}
