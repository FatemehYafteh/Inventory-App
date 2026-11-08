import { useTranslation } from 'react-i18next';

const MARK = '\u0001';
const PART = new RegExp(`(${MARK}\\w+${MARK})`);
const NAME = new RegExp(`^${MARK}(\\w+)${MARK}$`);

/**
 * A translated sentence with user-entered values (a product title, a person's name) in <bdi>, so
 * a value in another script or with punctuation at its edge keeps its own direction instead of
 * being reordered by the sentence around it. The sentence is translated with placeholders for
 * the values, then split, so the locale files stay plain strings.
 */
export function TBdi({ i18nKey, values }) {
  const { t } = useTranslation();
  const placeholders = Object.fromEntries(
    Object.keys(values).map((key) => [key, `${MARK}${key}${MARK}`]),
  );
  const text = t(i18nKey, { ...placeholders, interpolation: { escapeValue: false } });
  return text.split(PART).map((part, index) => {
    const match = NAME.exec(part);
    return match ? <bdi key={index}>{values[match[1]]}</bdi> : part;
  });
}
