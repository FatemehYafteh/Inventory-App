import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    contactPerson: { type: String, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 40 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    address: { type: String, trim: true, maxlength: 300 },
    notes: { type: String, trim: true, maxlength: 1000 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

supplierSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

supplierSchema.virtual('productCount', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'supplier',
  count: true,
});

export const Supplier = mongoose.model('Supplier', supplierSchema);
