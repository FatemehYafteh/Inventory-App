import { LEGACY_INITIAL_NOTE, StockMovement } from '../models/StockMovement.js';

/**
 * Gives old "initial stock" movements the `reason` marker that newer ones store. Before
 * `reason` existed, the first movement of a product stored the English text "Initial stock" as
 * its note; `reasonAndNote()` maps that on every read. After this has run on a database, no
 * movement needs that mapping. Only `reason` and `note` change (movements are history).
 * Safe to run again: it only touches movements that still have the legacy note and no reason.
 * Returns how many movements it changed.
 */
export async function migrateInitialReason() {
  const result = await StockMovement.updateMany(
    { note: LEGACY_INITIAL_NOTE, reason: null },
    { $set: { reason: 'initial', note: '' } },
  );
  return result.modifiedCount;
}
