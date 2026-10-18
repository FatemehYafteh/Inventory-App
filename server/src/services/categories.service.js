import mongoose from 'mongoose';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { AppError } from '../utils/AppError.js';

const CASE_INSENSITIVE = { locale: 'en', strength: 2 };

function notFound() {
  return new AppError(404, 'NOT_FOUND', 'Category not found');
}

function duplicateTitle() {
  return new AppError(409, 'DUPLICATE_NAME', 'A category with this title already exists', {
    title: 'A category with this title already exists',
  });
}

/** Products per category, archived included, in one grouped query. */
async function productCounts(ids) {
  const rows = await Product.aggregate([
    { $match: { category: { $in: ids } } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
}

function present(category, counts) {
  return {
    id: category.id,
    title: category.title,
    description: category.description ?? '',
    productCount: counts.get(category.id) ?? 0,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

async function presentOne(category) {
  return present(category, await productCounts([category._id]));
}

export async function listCategories() {
  const categories = await Category.find().collation(CASE_INSENSITIVE).sort({ title: 1 });
  const counts = await productCounts(categories.map((category) => category._id));
  return categories.map((category) => present(category, counts));
}

export async function createCategory({ title, description }) {
  try {
    const category = await Category.create({ title, ...(description && { description }) });
    return await presentOne(category);
  } catch (error) {
    if (error?.code === 11000) throw duplicateTitle();
    throw error;
  }
}

export async function updateCategory(id, { title, description }) {
  if (!mongoose.isValidObjectId(id)) throw notFound();
  const category = await Category.findById(id);
  if (!category) throw notFound();
  if (title !== undefined) category.title = title;
  if (description !== undefined) category.description = description || undefined;
  try {
    await category.save();
  } catch (error) {
    if (error?.code === 11000) throw duplicateTitle();
    throw error;
  }
  return presentOne(category);
}

/**
 * Counts the products (archived included) and deletes in one transaction. Product create and
 * update write this category document in their own transaction (products.service.js), so a
 * product being assigned at the same moment conflicts with this delete: either the delete
 * retries and reports IN_USE, or the product write is refused.
 */
export async function deleteCategory(id) {
  if (!mongoose.isValidObjectId(id)) throw notFound();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const category = await Category.findById(id).session(session);
      if (!category) throw notFound();
      const productCount = await Product.countDocuments({ category: category._id }).session(
        session,
      );
      if (productCount > 0) {
        const noun = productCount === 1 ? 'product' : 'products';
        throw new AppError(
          409,
          'IN_USE',
          `Used by ${productCount} ${noun}, including archived ones. Move or delete them first.`,
          undefined,
          { productCount },
        );
      }
      await Category.deleteOne({ _id: category._id }).session(session);
    });
  } finally {
    await session.endSession();
  }
}
