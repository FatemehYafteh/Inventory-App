import { formatNumber } from '@/lib/format';

/** A signed change as text, so the direction never depends on colour: +5, −2. */
export function signedChange(t, change) {
  return change > 0
    ? t('movements.plus', { n: formatNumber(change) })
    : t('movements.minus', { n: formatNumber(Math.abs(change)) });
}
