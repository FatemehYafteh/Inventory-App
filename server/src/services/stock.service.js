import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { StockMovement } from '../models/StockMovement.js';
import { AppError } from '../utils/AppError.js';

const notFound = () => new AppError(404, 'NOT_FOUND', 'Product not found');

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
    return new AppError(409, 'PRODUCT_ARCHIVED', 'Restore this product before changing its stock');
  }
  return new AppError(400, 'INSUFFICIENT_STOCK', 'Not enough stock for this change');
}

/**
 * Applies one stock change and writes its movement in a single transaction, so quantity and
 * history cannot diverge. `type` is receive, ship, adjust, increment or decrement; `quantity` is
 * the amount for receive and ship, the target quantity for adjust, and is ignored for the
 * one-step types. The performer always comes from `user`, never from the request body.
 * Returns `{ product, movement }` (documents).
 */
export async function changeStock(productId, user, { type, quantity, note }) {
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
          const message = 'The new quantity is the same as the current one';
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
