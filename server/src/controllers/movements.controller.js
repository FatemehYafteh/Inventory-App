import * as movements from '../services/movements.service.js';

export async function list(req, res) {
  res.json(await movements.listAllMovements(req.user, req.validatedQuery));
}

export async function performers(req, res) {
  res.json(await movements.listPerformers(req.user));
}
