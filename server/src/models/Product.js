import mongoose from 'mongoose';

export const STOCK_STATUSES = ['in_stock', 'low_stock', 'out_of_stock'];

/** Derived status: out at 0, low at or below the reorder level, otherwise in stock. */
export function stockStatus({ quantity, reorderLevel }) {
  if (quantity === 0) return 'out_of_stock';
  if (quantity <= reorderLevel) return 'low_stock';
  return 'in_stock';
}

const integerMin0 = {
  validator: (value) => Number.isInteger(value) && value >= 0,
  message: '{PATH} must be a whole number of 0 or more',
};

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    sku: { type: String, required: true, trim: true, uppercase: true, maxlength: 64 },
    description: { type: String, trim: true, maxlength: 2000 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    price: {
      type: Number,
      required: true,
      min: 0,
      set: (value) => (typeof value === 'number' ? Math.round(value * 100) / 100 : value),
    },
    quantity: { type: Number, default: 0, validate: integerMin0 },
    reorderLevel: { type: Number, default: 0, validate: integerMin0 },
    isArchived: { type: Boolean, default: false },
    archivedAt: Date,
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

productSchema.virtual('stockStatus').get(function getStockStatus() {
  return stockStatus(this);
});

// SKUs are stored uppercase, so a plain unique index is case-insensitive.
productSchema.index({ sku: 1 }, { unique: true });
// The list always filters on isArchived and sorts by one column, so each sort has a compound
// index that starts with isArchived. The title sort is case-insensitive (the collation the list
// uses), and an index only serves a sort with the same collation. _id breaks ties.
const LIST_COLLATION = { locale: 'en', strength: 2 };
productSchema.index({ isArchived: 1, title: 1, _id: 1 }, { collation: LIST_COLLATION });
productSchema.index({ isArchived: 1, quantity: 1, _id: 1 });
productSchema.index({ isArchived: 1, price: 1, _id: 1 });
productSchema.index({ category: 1, isArchived: 1 });
productSchema.index({ supplier: 1, isArchived: 1 });

export const Product = mongoose.model('Product', productSchema);
