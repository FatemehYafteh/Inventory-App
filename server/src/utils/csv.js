import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

// Excel reads a file as UTF-8 (so Persian names show correctly) only when it starts with a BOM.
const BOM = '﻿';
// A spreadsheet runs a text cell that starts with one of these as a formula (PRD 5.10). Tab and
// carriage return are included because some programs trim them before looking at the first
// character.
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * One cell as CSV text. Numbers, booleans and dates are written as they are, so a change of -5
 * stays a number; only text is checked for a formula start, which gets a leading apostrophe so
 * the spreadsheet shows it as text. Text with a comma, quote or line break is quoted.
 */
export function csvCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  const text = FORMULA_START.test(value) ? `'${value}` : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function csvLine(cells) {
  return `${cells.map(csvCell).join(',')}\r\n`;
}

/**
 * Streams a CSV download: a BOM, the header row, then one line per item of `rows` (an async
 * iterable of cell arrays), so memory stays flat however many rows match. The first row is read
 * before the headers go out, so an error while starting the query still gets a normal JSON
 * error response. An error after that can only cut the download short.
 */
export async function sendCsv(res, filename, header, rows) {
  const iterator = rows[Symbol.asyncIterator]();
  const first = await iterator.next();

  async function* lines() {
    yield BOM + csvLine(header);
    let next = first;
    while (!next.done) {
      yield csvLine(next.value);
      next = await iterator.next();
    }
  }

  res.status(200).set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
  });
  try {
    await pipeline(Readable.from(lines()), res);
  } catch {
    // The client went away or the query failed part-way; nothing more can be sent.
    res.destroy();
  }
}

/** `name-2026-10-21.csv` for today (UTC). */
export function csvFilename(name, now = new Date()) {
  return `${name}-${now.toISOString().slice(0, 10)}.csv`;
}
