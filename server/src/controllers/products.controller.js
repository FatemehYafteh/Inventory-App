import * as products from '../services/products.service.js';

export async function list(req, res) {
  res.json(await products.listProducts(req.user, req.validatedQuery));
}

export async function get(req, res) {
  res.json({ product: await products.getProduct(req.user, req.params.id) });
}

export async function create(req, res) {
  res.status(201).json({ product: await products.createProduct(req.body) });
}

export async function update(req, res) {
  res.json({ product: await products.updateProduct(req.user, req.params.id, req.body) });
}

export async function archive(req, res) {
  res.json({ product: await products.archiveProduct(req.params.id) });
}

export async function restore(req, res) {
  res.json({ product: await products.restoreProduct(req.params.id) });
}
