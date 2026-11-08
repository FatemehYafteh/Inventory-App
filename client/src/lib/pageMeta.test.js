import { describe, expect, it } from 'vitest';
import { NOT_FOUND_TITLE, documentTitle, isIndexable, titleKeyFor } from './pageMeta';

describe('titleKeyFor', () => {
  it('names every route, with or without a trailing slash', () => {
    expect(titleKeyFor('/')).toBe('layout.nav.dashboard');
    expect(titleKeyFor('/products')).toBe('layout.nav.products');
    expect(titleKeyFor('/products/')).toBe('layout.nav.products');
    expect(titleKeyFor('/reset-password')).toBe('auth.reset.title');
  });

  it('uses the not-found title for an unknown path', () => {
    expect(titleKeyFor('/nope')).toBe(NOT_FOUND_TITLE);
  });
});

describe('documentTitle', () => {
  it('puts the page before the brand, or shows only the brand', () => {
    expect(documentTitle('Products', 'Anbar')).toBe('Products · Anbar');
    expect(documentTitle('', 'Anbar')).toBe('Anbar');
  });
});

describe('isIndexable', () => {
  it('lets only the login and register pages be indexed', () => {
    expect(isIndexable('/login')).toBe(true);
    expect(isIndexable('/register/')).toBe(true);
    for (const path of ['/', '/products', '/users', '/reset-password', '/verify-email', '/nope']) {
      expect(isIndexable(path), path).toBe(false);
    }
  });
});
