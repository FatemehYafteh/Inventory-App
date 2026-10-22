import { m } from '@inventory/shared/errorCodes';
import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { StockMovement } from '../models/StockMovement.js';
import { AppError } from '../utils/AppError.js';

const notFound = () => new AppError(404, 'NOT_FOUND', m.PRODUCT_NOT_FOUND);

/** The signed change a movement makes. `adjust` has no fixed delta: it depends on the current quantity. */
function fixedDelta(type, quantity) {
  switch (type) {
    case 'receive':
      return quantity;
    case 'ship':
      return -quantity;
    case 'increment':
      return 1;
    case 'decrement':
      return -1;
    default:
      return null;
  }
}

/** Why an update matched nothing, read inside the same transaction. */
async function refusal(productId, session) {
  const product = await Product.findById(productId).session(session);
  if (!product) return notFound();
  if (product.isArchived) {
    return new AppError(409, 'PRODUCT_ARCHIVED', m.PRODUCT_ARCHIVED_RESTORE_FIRST);
  }
  return new AppError(400, 'INSUFFICIENT_STOCK', m.STOCK_INSUFFICIENT);
}

/**
 * Applies one stock change and writes its movement in a single transaction, so quantity and
 * history cannot diverge. `type` is receive, ship, adjust, increment or decrement; `quantity` is
 * the amount for receive and ship, the target quantity for adjust, and is ignored for the
 * one-step types. The performer always comes from `user`, never from the request body.
 * Returns `{ product, movement }` (documents).
 */
export async function changeStock(productId, user, { type, quantity, note }) {
  if (!mongoose.isValidObjectId(productId)) throw notFound();
  const session = await mongoose.startSession();
  try {
    let result;
    // withTransaction re-runs this callback on a transient error such as a write conflict, so
    // everything the change depends on is read inside it.
    await session.withTransaction(async () => {
      let delta = fixedDelta(type, quantity);
      let guard = {};

      if (type === 'adjust') {
        const current = await Product.findOne({ _id: productId, isArchived: false })
          .select('quantity')
          .session(session);
        if (!current) throw await refusal(productId, session);
        delta = quantity - current.quantity;
        if (delta === 0) {
          const message = m.STOCK_NO_CHANGE;
          throw new AppError(400, 'NO_CHANGE', message, { quantity: message });
        }
        guard = { quantity: current.quantity };
      } else if (delta < 0) {
        guard = { quantity: { $gte: -delta } };
      }

      const product = await Product.findOneAndUpdate(
        { _id: productId, isArchived: false, ...guard },
        { $inc: { quantity: delta } },
        { new: true, session },
      );
      if (!product) throw await refusal(productId, session);

      const [movement] = await StockMovement.create(
        [
          {
            product: product._id,
            type,
            quantityChange: delta,
            quantityBefore: product.quantity - delta,
            quantityAfter: product.quantity,
            // A receive records the supplier the product has right now.
            ...(type === 'receive' && product.supplier && { supplier: product.supplier }),
            ...(note && { note }),
            performedBy: user._id,
            performedByName: user.name,
          },
        ],
        { session },
      );
      result = { product, movement };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

function presentMovement(movement) {
  return {
    id: movement.id,
    type: movement.type,
    quantityChange: movement.quantityChange,
    quantityBefore: movement.quantityBefore,
    quantityAfter: movement.quantityAfter,
    supplier: movement.supplier?.name
      ? { id: movement.supplier.id, name: movement.supplier.name }
      : null,
    note: movement.note ?? '',
    performedBy: { id: String(movement.performedBy), name: movement.performedByName },
    createdAt: movement.createdAt,
  };
}

/** The response of a stock change: the product's new quantity and the movement it wrote. */
export async function presentStockResult({ product, movement }) {
  await movement.populate('supplier', 'name');
  return {
    product: { id: product.id, quantity: product.quantity, stockStatus: product.stockStatus },
    movement: presentMovement(movement),
  };
}

/**
 * One page of a product's movements, newest first (the id breaks ties so pages never repeat).
 * Staff cannot see archived products, so for them an archived product's history does not exist.
 */
export async function listMovements(user, productId, { page, limit }) {
  if (!mongoose.isValidObjectId(productId)) throw notFound();
  const product = await Product.findById(productId).select('isArchived');
  if (!product || (product.isArchived && user.role !== 'admin')) throw notFound();
  const filter = { product: productId };
  const [movements, total] = await Promise.all([
    StockMovement.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('supplier', 'name'),
    StockMovement.countDocuments(filter),
  ]);
  return { items: movements.map(presentMovement), total, page, limit };
}
