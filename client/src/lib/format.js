import i18n from '@/i18n';

// `fa-IR` writes Persian digits (۱۲۳) and Persian separators; `-u-ca-persian` is the Jalali
// calendar. English keeps Latin digits and the Gregorian calendar. Stored values never change:
// these only format what is shown.
const LOCALES = { en: 'en-US', fa: 'fa-IR-u-ca-persian' };

const cache = new Map();

/** One formatter per language and kind, so a table of rows does not build one per cell. */
function formatter(kind, create) {
  const language = i18n.language in LOCALES ? i18n.language : 'en';
  const key = `${kind}:${language}`;
  if (!cache.has(key)) cache.set(key, create(LOCALES[language]));
  return cache.get(key);
}

/** A whole or decimal number in the current language, e.g. `1,234` or `۱٬۲۳۴`. */
export function formatNumber(value) {
  return formatter('number', (locale) => new Intl.NumberFormat(locale)).format(value);
}

/** A price as US dollars, e.g. `$1,234.50`. The PRD names no currency; change it here. */
export function formatPrice(value) {
  return formatter(
    'currency',
    (locale) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }),
  ).format(value);
}

/** An ISO timestamp as a short date, e.g. `Oct 14, 2026` or `۲۲ مهر ۱۴۰۵`. */
export function formatDate(value) {
  return value
    ? formatter(
        'date',
        (locale) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }),
      ).format(new Date(value))
    : '';
}

/** An ISO timestamp with the time, e.g. `Oct 14, 2026, 10:30 AM`. */
export function formatDateTime(value) {
  return value
    ? formatter(
        'dateTime',
        (locale) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
      ).format(new Date(value))
    : '';
}
