import { m } from '@inventory/shared/errorCodes';
import mongoose from 'mongoose';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { StockMovement } from '../models/StockMovement.js';
import { Supplier } from '../models/Supplier.js';
import { AppError } from '../utils/AppError.js';

const CASE_INSENSITIVE = { locale: 'en', strength: 2 };
const INITIAL_STOCK_NOTE = 'Initial stock';

function notFound() {
  return new AppError(404, 'NOT_FOUND', m.PRODUCT_NOT_FOUND);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Stock status is derived, never stored (PRD section 4), so it is filtered with $expr.
const STATUS_FILTERS = {
  out_of_stock: { quantity: 0 },
  low_stock: {
    $expr: { $and: [{ $gt: ['$quantity', 0] }, { $lte: ['$quantity', '$reorderLevel'] }] },
  },
  in_stock: { $expr: { $gt: ['$quantity', '$reorderLevel'] } },
};

function filterFor({ search, category, supplier, status, archived }) {
  const filter = {};
  // "Show archived" adds archived products to the list; without it they are hidden.
  if (!archived) filter.isArchived = false;
  if (category) filter.category = category;
  if (supplier) filter.supplier = supplier;
  if (status) Object.assign(filter, STATUS_FILTERS[status]);
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ title: pattern }, { sku: pattern }];
  }
  return filter;
}

function present(product) {
  return {
    id: product.id,
    title: product.title,
    sku: product.sku,
    description: product.description ?? '',
    category: product.category && { id: product.category.id, title: product.category.title },
    supplier: product.supplier ? { id: product.supplier.id, name: product.supplier.name } : null,
    price: product.price,
    quantity: product.quantity,
    reorderLevel: product.reorderLevel,
    stockStatus: product.stockStatus,
    isArchived: product.isArchived,
    archivedAt: product.archivedAt ?? null,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function withRelations(query) {
  return query.populate('category', 'title').populate('supplier', 'name');
}

/**
 * One page of products. Sorting and paging run in the database across the whole set, with the
 * id as a tiebreaker so pages never repeat or skip a row. Only admins may ask for archived ones.
 */
export async function listProducts(user, query) {
  const { page, limit, sortBy, order } = query;
  if (query.archived && user.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', m.NO_ACCESS);
  }
  const filter = filterFor(query);
  const find = Product.find(filter);
  // Only the title sort needs case-insensitive order; the numeric sorts keep their indexes.
  if (sortBy === 'title') find.collation(CASE_INSENSITIVE);
  const [products, total] = await Promise.all([
    withRelations(
      find
        .sort({ [sortBy]: order === 'desc' ? -1 : 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ),
    Product.countDocuments(filter),
  ]);
  return { items: products.map(present), total, page, limit };
}

/** Staff cannot see archived products, even by a direct link. */
export async function getProduct(user, id) {
  if (!mongoose.isValidObjectId(id)) throw notFound();
  const product = await withRelations(Product.findById(id));
  if (!product || (product.isArchived && user.role !== 'admin')) throw notFound();
  return present(product);
}

function fieldError(field, message) {
  return new AppError(400, 'VALIDATION_ERROR', m.VALIDATION_FAILED, { [field]: message });
}

function duplicateSku() {
  return new AppError(409, 'DUPLICATE_SKU', m.PRODUCT_SKU_EXISTS, {
    sku: m.PRODUCT_SKU_EXISTS,
  });
}

/**
 * Writes the category document (its `updatedAt`) inside the transaction, so a concurrent delete
 * of the same category conflicts with this write instead of slipping past it (plan Q3).
 */
async function referenceCategory(id, session) {
  const result = await Category.updateOne(
    { _id: id },
    { $currentDate: { updatedAt: true } },
    { session },
  );
  if (result.matchedCount === 0) throw fieldError('category', m.CATEGORY_MUST_EXIST);
}

/** As `referenceCategory`; a supplier chosen for a product must also be active. */
async function referenceSupplier(id, session) {
  const supplier = await Supplier.findOneAndUpdate(
    { _id: id, isActive: true },
    { $currentDate: { updatedAt: true } },
    { session },
  );
  if (!supplier) throw fieldError('supplier', m.SUPPLIER_MUST_BE_ACTIVE);
}

async function inTransaction(work) {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => work(session));
  } finally {
    await session.endSession();
  }
}

async function presentById(id) {
  return present(await withRelations(Product.findById(id)));
}

/**
 * A new product starts at 0, or at `initialQuantity`: then the product and one "Initial stock"
 * receive movement (recording the product's supplier and the creator) are written in the same
 * transaction, so quantity and history agree from the start. After that, quantity only changes
 * through stock actions.
 */
export async function createProduct(
  user,
  { supplier, description, initialQuantity = 0, ...fields },
) {
  const id = new mongoose.Types.ObjectId();
  try {
    await inTransaction(async (session) => {
      await referenceCategory(fields.category, session);
      if (supplier) await referenceSupplier(supplier, session);
      await Product.create(
        [
          {
            _id: id,
            ...fields,
            quantity: initialQuantity,
            ...(supplier && { supplier }),
            ...(description && { description }),
          },
        ],
        { session },
      );
      if (initialQuantity > 0) {
        await StockMovement.create(
          [
            {
              product: id,
              type: 'receive',
              quantityChange: initialQuantity,
              quantityBefore: 0,
              quantityAfter: initialQuantity,
              ...(supplier && { supplier }),
              note: INITIAL_STOCK_NOTE,
              performedBy: user._id,
              performedByName: user.name,
            },
          ],
          { session },
        );
      }
    });
  } catch (error) {
    if (error?.code === 11000) throw duplicateSku();
    throw error;
  }
  return presentById(id);
}

/**
 * Partial update. `null` or an empty value clears the supplier or description. A supplier must be
 * active only when it is newly chosen, so a product keeps an inactive supplier it already has.
 * Staff cannot see archived products, so for them an archived product does not exist.
 */
export async function updateProduct(user, id, fields) {
  if (!mongoose.isValidObjectId(id)) throw notFound();
  try {
    await inTransaction(async (session) => {
      const product = await Product.findById(id).session(session);
      if (!product || (product.isArchived && user.role !== 'admin')) throw notFound();

      const { category, supplier, description, ...plain } = fields;
      Object.assign(product, plain);
      if (description !== undefined) product.description = description || undefined;
      if (category !== undefined && String(product.category) !== category) {
        await referenceCategory(category, session);
        product.category = category;
      }
      if (supplier !== undefined && String(product.supplier ?? '') !== (supplier ?? '')) {
        if (supplier) await referenceSupplier(supplier, session);
        product.supplier = supplier ?? undefined;
      }
      await product.save({ session });
    });
  } catch (error) {
    if (error?.code === 11000) throw duplicateSku();
    throw error;
  }
  return presentById(id);
}

/**
 * One conditional update flips the flag only from the opposite state, so two requests at once
 * cannot both succeed. A miss is a 404 if the product does not exist, otherwise a 409.
 */
async function setArchived(id, archived) {
  if (!mongoose.isValidObjectId(id)) throw notFound();
  const update = archived
    ? { $set: { isArchived: true, archivedAt: new Date() } }
    : { $set: { isArchived: false }, $unset: { archivedAt: '' } };
  const product = await withRelations(
    Product.findOneAndUpdate({ _id: id, isArchived: !archived }, update, { new: true }),
  );
  if (product) return present(product);
  if (!(await Product.exists({ _id: id }))) throw notFound();
  throw archived
    ? new AppError(409, 'ALREADY_ARCHIVED', m.PRODUCT_ALREADY_ARCHIVED)
    : new AppError(409, 'NOT_ARCHIVED', m.PRODUCT_NOT_ARCHIVED);
}

export const archiveProduct = (id) => setArchived(id, true);
export const restoreProduct = (id) => setArchived(id, false);
