import * as suppliers from '../services/suppliers.service.js';

export async function list(req, res) {
  res.json(await suppliers.listSuppliers(req.validatedQuery));
}

export async function create(req, res) {
  res.status(201).json({ supplier: await suppliers.createSupplier(req.body) });
}

export async function update(req, res) {
  res.json({ supplier: await suppliers.updateSupplier(req.params.id, req.body) });
}

export async function remove(req, res) {
  await suppliers.deleteSupplier(req.params.id);
  res.status(204).end();
}
