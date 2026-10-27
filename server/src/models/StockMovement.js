import mongoose from 'mongoose';

export const MOVEMENT_TYPES = ['receive', 'ship', 'adjust', 'increment', 'decrement'];

const integer = { validator: Number.isInteger, message: '{PATH} must be a whole number' };

// Movements are history: never edited or deleted once written.
const stockMovementSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    type: { type: String, enum: MOVEMENT_TYPES, required: true },
    quantityChange: { type: Number, required: true, validate: integer },
    quantityBefore: { type: Number, required: true, min: 0, validate: integer },
    quantityAfter: { type: Number, required: true, min: 0, validate: integer },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    note: { type: String, trim: true, maxlength: 500 },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    performedByName: { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

stockMovementSchema.index({ product: 1, createdAt: -1 });
stockMovementSchema.index({ type: 1 });
stockMovementSchema.index({ supplier: 1 });
stockMovementSchema.index({ performedBy: 1, createdAt: -1 });
stockMovementSchema.index({ createdAt: -1 });

export const StockMovement = mongoose.model('StockMovement', stockMovementSchema);
