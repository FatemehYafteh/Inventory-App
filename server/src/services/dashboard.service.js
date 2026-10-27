import { Product } from '../models/Product.js';
import { listAllMovements } from './movements.service.js';
import { present, withRelations } from './products.service.js';

const LOW_STOCK_LIST_SIZE = 10;
const RECENT_MOVEMENTS = 10;

const ACTIVE = { isArchived: false };

/** Counts, units and value of the active products, in one pass in the database. */
async function summary() {
  const [row] = await Product.aggregate([
    { $match: ACTIVE },
    {
      $group: {
        _id: null,
        activeProducts: { $sum: 1 },
        totalUnits: { $sum: '$quantity' },
        inventoryValue: { $sum: { $multiply: ['$price', '$quantity'] } },
        outOfStockCount: { $sum: { $cond: [{ $eq: ['$quantity', 0] }, 1, 0] } },
        lowStockCount: {
          $sum: {
            $cond: [
              { $and: [{ $gt: ['$quantity', 0] }, { $lte: ['$quantity', '$reorderLevel'] }] },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);
  return {
    activeProducts: row?.activeProducts ?? 0,
    totalUnits: row?.totalUnits ?? 0,
    // Prices have two decimals; rounding hides floating-point noise from the sum.
    inventoryValue: Math.round((row?.inventoryValue ?? 0) * 100) / 100,
    lowStockCount: row?.lowStockCount ?? 0,
    outOfStockCount: row?.outOfStockCount ?? 0,
  };
}

/**
 * The products that need restocking: out of stock first, then low stock by lowest
 * quantity-to-reorder ratio. Out of stock is ratio 0, which also avoids dividing by a reorder
 * level of 0. Ties go by quantity, title, then id so the list never changes order on its own.
 */
async function lowStock() {
  const ranked = await Product.aggregate([
    { $match: { ...ACTIVE, $expr: { $lte: ['$quantity', '$reorderLevel'] } } },
    {
      $addFields: {
        ratio: {
          $cond: [{ $eq: ['$quantity', 0] }, 0, { $divide: ['$quantity', '$reorderLevel'] }],
        },
      },
    },
    { $sort: { ratio: 1, quantity: 1, title: 1, _id: 1 } },
    { $limit: LOW_STOCK_LIST_SIZE },
    { $project: { _id: 1 } },
  ]);
  const ids = ranked.map((row) => row._id);
  const products = await withRelations(Product.find({ _id: { $in: ids } }));
  const byId = new Map(products.map((product) => [product.id, product]));
  return ids.map((id) => present(byId.get(String(id))));
}

/** Everything the dashboard shows. Movements follow the same visibility rule as the Movements page. */
export async function getDashboard(user) {
  const [summaryResult, lowStockItems, recent] = await Promise.all([
    summary(),
    lowStock(),
    listAllMovements(user, { page: 1, limit: RECENT_MOVEMENTS }),
  ]);
  return { summary: summaryResult, lowStock: lowStockItems, recentMovements: recent.items };
}
