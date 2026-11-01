import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');

/** The content of <meta property="..."> (or name="...") in index.html. */
function meta(key) {
  const pattern = String.raw`<meta\s[^>]*(?:property|name)="${key}"[^>]*>`;
  const tag = html.match(new RegExp(pattern, 's'))?.[0];
  return tag?.match(/content="([^"]*)"/s)?.[1];
}

describe('link preview tags in index.html', () => {
  it('sets og:title, og:description and og:image', () => {
    expect(meta('og:title')).toBeTruthy();
    expect(meta('og:description')).toBeTruthy();
    expect(meta('og:image')).toBeTruthy();
  });

  it('uses absolute URLs, because crawlers do not resolve relative ones', () => {
    expect(meta('og:url')).toMatch(/^https:\/\//);
    expect(meta('og:image')).toMatch(/^https:\/\//);
  });

  it('points og:image at a file that is shipped in public/', () => {
    const file = new URL(meta('og:image')).pathname;
    expect(existsSync(resolve(root, 'public', `.${file}`))).toBe(true);
  });
});
