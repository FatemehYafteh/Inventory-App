import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { LANGUAGES } from '@inventory/shared/schemas';

// One JSON file per area in locales/<language>/. A file's name is the top-level key of its
// texts, so locales/en/products.json is read as t('products.<key>').
const files = import.meta.glob('./locales/*/*.json', { eager: true, import: 'default' });

/** All texts of a language: { <area>: { ... } } built from its files. */
function textsOf(language) {
  const texts = {};
  for (const [path, content] of Object.entries(files)) {
    const [, fileLanguage, area] = path.match(/\.\/locales\/([^/]+)\/([^/]+)\.json$/);
    if (fileLanguage === language) texts[area] = content;
  }
  return texts;
}

export const LANGUAGE_STORAGE_KEY = 'language';

function isSupported(language) {
  return LANGUAGES.includes(language);
}

/** The language kept in this browser, or null (storage can be blocked or empty). */
export function storedLanguage() {
  try {
    const value = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isSupported(value) ? value : null;
  } catch {
    return null;
  }
}

export function rememberLanguage(language) {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Storage is only a convenience for signed-out pages.
  }
}

/** Browser language (`fa`, `fa-IR`) as a supported language, else null. */
function browserLanguage() {
  const tag = typeof navigator === 'undefined' ? '' : (navigator.language ?? '');
  const base = tag.toLowerCase().split('-')[0];
  return isSupported(base) ? base : null;
}

/** Saved choice, then the browser's language, then English. */
export function initialLanguage() {
  return storedLanguage() ?? browserLanguage() ?? 'en';
}

/** Persian reads right to left, English left to right. */
export const DIRECTIONS = { en: 'ltr', fa: 'rtl' };

export function directionOf(language) {
  return DIRECTIONS[language] ?? 'ltr';
}

/** Puts `lang` and `dir` on <html> so the browser lays the page out for the language. */
function applyDocumentLanguage(language) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = language;
  document.documentElement.dir = directionOf(language);
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: textsOf('en') }, fa: { translation: textsOf('fa') } },
  lng: initialLanguage(),
  fallbackLng: 'en',
  supportedLngs: LANGUAGES,
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', applyDocumentLanguage);
applyDocumentLanguage(i18n.language);

export default i18n;
