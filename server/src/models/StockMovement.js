import mongoose from 'mongoose';

export const MOVEMENT_TYPES = ['receive', 'ship', 'adjust', 'increment', 'decrement'];

// Why the system wrote a movement, as a marker the client translates (a note is free text the
// user typed, and the system must not store English prose in it). `initial`: the quantity a
// product was created with.
export const MOVEMENT_REASONS = ['initial'];

// Before `reason` existed, the initial movement stored this English text as its note.
const LEGACY_INITIAL_NOTE = 'Initial stock';

/** The `reason` and `note` to send for a movement, mapping the legacy English note to `initial`. */
export function reasonAndNote(movement) {
  const legacy = !movement.reason && movement.note === LEGACY_INITIAL_NOTE;
  return {
    reason: movement.reason ?? (legacy ? 'initial' : null),
    note: legacy ? '' : (movement.note ?? ''),
  };
}

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
    reason: { type: String, enum: MOVEMENT_REASONS },
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
