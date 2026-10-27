import * as categories from '../services/categories.service.js';

export async function list(_req, res) {
  res.json({ items: await categories.listCategories() });
}

export async function create(req, res) {
  res.status(201).json({ category: await categories.createCategory(req.body) });
}

export async function update(req, res) {
  res.json({ category: await categories.updateCategory(req.params.id, req.body) });
}

export async function remove(req, res) {
  await categories.deleteCategory(req.params.id);
  res.status(204).end();
}
