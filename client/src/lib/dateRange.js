function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * The chosen days as the instants the API takes, in the browser's zone, the same zone the tables
 * show times in: `from` is the start of the first day (inclusive) and `to` is the start of the
 * day after the last one (exclusive). A single chosen day is a range of that day.
 * Works on ordinary Date values, so the Jalali picker needs nothing special.
 */
export function daysToInstants({ from, to }) {
  if (!from) return { from: undefined, to: undefined };
  const first = startOfDay(from);
  const last = startOfDay(to ?? from);
  // new Date(y, m, d + 1) lets the zone decide the length of the day (23, 24 or 25 hours).
  const after = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
  return { from: first.toISOString(), to: after.toISOString() };
}

/** The reverse, for showing the chosen days again: the last day is the one before `to`. */
export function instantsToDays({ from, to }) {
  const start = from ? new Date(from) : undefined;
  if (!start || Number.isNaN(start.getTime())) return { from: undefined, to: undefined };
  const end = to ? new Date(new Date(to).getTime() - 1) : undefined;
  return { from: start, to: end && !Number.isNaN(end.getTime()) ? end : undefined };
}
