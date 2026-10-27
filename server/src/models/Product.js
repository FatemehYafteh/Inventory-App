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
productSchema.index({ category: 1 });
productSchema.index({ supplier: 1 });
productSchema.index({ title: 1 });
productSchema.index({ quantity: 1 });
productSchema.index({ price: 1 });
productSchema.index({ isArchived: 1 });

export const Product = mongoose.model('Product', productSchema);
