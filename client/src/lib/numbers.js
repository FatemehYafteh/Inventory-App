// Persian (۰-۹, U+06F0) and Arabic-Indic (٠-٩, U+0660) digits, which a Persian keyboard types.
const PERSIAN_ZERO = 0x06f0;
const ARABIC_ZERO = 0x0660;

/**
 * Typed number text with Persian and Arabic-Indic digits turned into Latin digits, and the
 * Persian decimal (٫) and thousands (٬) separators into `.` and nothing. Text without those
 * characters comes back unchanged, so the API only ever sees Latin digits.
 */
export function normalizeDigits(text) {
  return String(text)
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - PERSIAN_ZERO))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - ARABIC_ZERO))
    .replace(/٫/g, '.')
    .replace(/[٬،]/g, '');
}

/**
 * The number typed in a text field, for React Hook Form's `setValueAs`. Empty or unreadable text
 * is NaN, which is what `valueAsNumber` gave for a number input, so the shared schema's error
 * for a missing number stays the same.
 */
export function parseNumberInput(text) {
  const normalized = normalizeDigits(text).trim();
  return normalized === '' ? Number.NaN : Number(normalized);
}
