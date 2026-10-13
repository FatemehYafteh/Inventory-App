import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

// Unique regardless of case: "Tools" and "tools" are the same category.
categorySchema.index({ title: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

categorySchema.virtual('productCount', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'category',
  count: true,
});

export const Category = mongoose.model('Category', categorySchema);
