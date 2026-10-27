import { csvFilename, sendCsv } from '../utils/csv.js';
import * as products from '../services/products.service.js';
import * as stock from '../services/stock.service.js';

export async function list(req, res) {
  res.json(await products.listProducts(req.user, req.validatedQuery));
}

export async function get(req, res) {
  res.json({ product: await products.getProduct(req.user, req.params.id) });
}

export async function create(req, res) {
  res.status(201).json({ product: await products.createProduct(req.user, req.body) });
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

export async function changeStock(req, res) {
  const result = await stock.changeStock(req.params.id, req.user, req.body);
  res.status(201).json(await stock.presentStockResult(result));
}

export async function movements(req, res) {
  res.json(await stock.listMovements(req.user, req.params.id, req.validatedQuery));
}

export async function exportCsv(req, res) {
  await sendCsv(
    res,
    csvFilename('products'),
    products.PRODUCT_CSV_HEADER,
    products.productCsvRows(req.user, req.validatedQuery),
  );
}
