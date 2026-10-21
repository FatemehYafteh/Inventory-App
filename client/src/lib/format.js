const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const date = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

/** A price as US dollars, e.g. `$1,234.50`. The PRD names no currency; change it here. */
export function formatPrice(value) {
  return currency.format(value);
}

/** An ISO timestamp as a short date, e.g. `Oct 14, 2026`. */
export function formatDate(value) {
  return value ? date.format(new Date(value)) : '';
}

const dateTime = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });

/** An ISO timestamp with the time, e.g. `Oct 14, 2026, 10:30 AM`. */
export function formatDateTime(value) {
  return value ? dateTime.format(new Date(value)) : '';
}
