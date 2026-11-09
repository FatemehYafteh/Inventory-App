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

/**
 * A price in Iranian Rial: a whole number (the Rial has no minor unit, so a fraction is rounded)
 * in the current language's digits and separators, then the unit, e.g. `1,250,000 Rial` or
 * `۱٬۲۵۰٬۰۰۰ ریال`. A no-break space keeps the unit on the same line as the number. The number and
 * the unit are built apart, instead of with Intl's currency style, so the unit is always after the
 * number and its label is a translation (common.currency.unit) like every other text.
 */
export function formatPrice(value) {
  const number = formatter(
    'price',
    (locale) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
  ).format(value);
  return `${number}\u00a0${i18n.t('common.currency.unit')}`;
}

/** A day of the month in the current calendar and digits: `14`, or `۲۲` (Mehr) in Persian. */
export function formatDay(value) {
  return formatter('day', (locale) => new Intl.DateTimeFormat(locale, { day: 'numeric' })).format(
    new Date(value),
  );
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
