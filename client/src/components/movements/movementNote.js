/**
 * The note to show for a movement. A movement written by the system carries a `reason` marker
 * instead of English text, so it is translated here; otherwise it is the note the user typed.
 */
export function movementNote(t, movement) {
  if (movement.reason) return t(`movements.reasons.${movement.reason}`);
  return movement.note || '';
}
