import { en } from './en.js';
import { fa } from './fa.js';

export const LANGUAGES = ['en', 'fa'];
const DICTIONARIES = { en, fa };

/** 'en' | 'fa' for a language string or anything with a `language` (a user); else 'en'. */
export function languageOf(userOrLanguage) {
  const value =
    userOrLanguage && typeof userOrLanguage === 'object' ? userOrLanguage.language : userOrLanguage;
  return LANGUAGES.includes(value) ? value : 'en';
}

function lookup(dictionary, key) {
  let node = dictionary;
  for (const part of String(key).split('.')) {
    if (node === null || typeof node !== 'object' || !Object.hasOwn(node, part)) return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * The text for `key` in `language`, with {{name}} placeholders filled from `vars`. A missing
 * key or unknown language falls back to English; a key missing in English returns the key.
 */
export function translate(language, key, vars = {}) {
  const template = lookup(DICTIONARIES[languageOf(language)], key) ?? lookup(en, key) ?? key;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : match,
  );
}
