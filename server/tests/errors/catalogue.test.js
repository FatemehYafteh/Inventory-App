import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CODES, MESSAGES, codeForMessage, messageFor } from '@inventory/shared/errorCodes';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, '../../src');
const sharedDir = path.resolve(here, '../../../shared');
const localesDir = path.resolve(here, '../../../client/src/i18n/locales');

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

describe('error catalogue', () => {
  it('has a unique English text for every message code', () => {
    const texts = Object.values(MESSAGES);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('looks codes up in both directions', () => {
    expect(codeForMessage('Name is required')).toBe('NAME_REQUIRED');
    expect(codeForMessage('not in the catalogue')).toBeNull();
    expect(messageFor('PRODUCT_NOT_FOUND')).toBe('Product not found');
    expect(messageFor('IN_USE')).toBe(CODES.IN_USE);
    expect(messageFor('NOPE')).toBeNull();
  });

  it('registers every AppError code and static message used in server/src', () => {
    const codeRe = /(?:new AppError\(\s*\d+|conflict\()\s*,?\s*'([A-Z_]+)'/g;
    const messageRe = /(?:new AppError\(\s*\d+|conflict\()\s*,?\s*'[A-Z_]+',\s*'([^'\n]*)'/g;
    const texts = new Set(Object.values(MESSAGES));
    const missingCodes = [];
    const missingMessages = [];
    for (const file of sourceFiles(srcDir)) {
      const source = fs.readFileSync(file, 'utf8');
      for (const [, code] of source.matchAll(codeRe)) {
        if (!(code in CODES)) missingCodes.push(`${path.basename(file)}: ${code}`);
      }
      for (const [, text] of source.matchAll(messageRe)) {
        if (!texts.has(text)) missingMessages.push(`${path.basename(file)}: ${text}`);
      }
    }
    expect(missingCodes).toEqual([]);
    expect(missingMessages).toEqual([]);
  });

  it('has no string-literal messages left in the shared schemas', () => {
    const dir = path.join(sharedDir, 'schemas');
    const files = fs.readdirSync(dir).filter((file) => file !== 'common-passwords.js');
    const literal = /(?:message|required_error|invalid_type_error):\s*['"`]/;
    for (const file of files) {
      expect(fs.readFileSync(path.join(dir, file), 'utf8'), file).not.toMatch(literal);
    }
  });

  it('keeps client en/errors.json equal to the catalogue', () => {
    const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en/errors.json'), 'utf8'));
    expect(en).toEqual({ messages: MESSAGES, codes: CODES });
  });

  it('has a Persian text for every catalogue entry and no orphans', () => {
    const fa = JSON.parse(fs.readFileSync(path.join(localesDir, 'fa/errors.json'), 'utf8'));
    expect(Object.keys(fa.messages).sort()).toEqual(Object.keys(MESSAGES).sort());
    expect(Object.keys(fa.codes).sort()).toEqual(Object.keys(CODES).sort());
    for (const text of [...Object.values(fa.messages), ...Object.values(fa.codes)]) {
      expect(text.trim()).not.toBe('');
    }
  });
});
