import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { LANGUAGES } from '@inventory/shared/schemas';
import en from './locales/en.json';
import fa from './locales/fa.json';

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

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fa: { translation: fa } },
  lng: initialLanguage(),
  fallbackLng: 'en',
  supportedLngs: LANGUAGES,
  interpolation: { escapeValue: false },
});

export default i18n;
