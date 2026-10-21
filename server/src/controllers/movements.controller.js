import { csvFilename, sendCsv } from '../utils/csv.js';
import * as movements from '../services/movements.service.js';

export async function list(req, res) {
  res.json(await movements.listAllMovements(req.user, req.validatedQuery));
}

export async function performers(req, res) {
  res.json(await movements.listPerformers(req.user));
}

export async function exportCsv(req, res) {
  await sendCsv(
    res,
    csvFilename('movements'),
    movements.MOVEMENT_CSV_HEADER,
    movements.movementCsvRows(req.user, req.validatedQuery),
  );
}
