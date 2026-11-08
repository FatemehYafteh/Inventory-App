import { screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { renderApp } from '@/test/render';
import { activeUser, server } from '@/test/server';

/**
 * Runs axe-core on every page, in English and Persian, signed out and signed in, with data and
 * without. Colour contrast is off: jsdom has no layout or computed colours, so it cannot judge
 * contrast (check that in a browser).
 */

const TOOLS = { id: 'c'.repeat(24), title: 'Tools' };
const item = (fields) => ({
  description: '',
  price: 10,
  quantity: 5,
  reorderLevel: 2,
  stockStatus: 'in_stock',
  isArchived: false,
  category: TOOLS,
  supplier: null,
  createdAt: '2026-10-14T10:00:00.000Z',
  ...fields,
});
const products = [
  item({ id: 'p1', title: 'Claw Hammer', sku: 'HAM-001', price: 12.5, quantity: 40 }),
  item({ id: 'p2', title: 'Wood Glue', sku: 'GLU-002', quantity: 0, stockStatus: 'out_of_stock' }),
  item({ id: 'p3', title: 'Hand Saw', sku: 'SAW-003', quantity: 1, stockStatus: 'low_stock' }),
];
const page = (items) => ({ items, total: items.length, page: 1, limit: 20 });
const admin = { ...activeUser, id: 'a1', name: 'Ana Admin', role: 'admin' };

/** A signed-in admin and list APIs that answer with `withData` rows or none. */
function signedIn(withData) {
  server.use(
    http.get('*/api/auth/me', () => HttpResponse.json({ user: admin })),
    http.get('*/api/products', () => HttpResponse.json(page(withData ? products : []))),
    http.get('*/api/categories', () =>
      HttpResponse.json({
        items: withData ? [{ ...TOOLS, description: 'Hand tools', productCount: 3 }] : [],
      }),
    ),
    http.get('*/api/suppliers', () => HttpResponse.json(page([]))),
    http.get('*/api/movements', () => HttpResponse.json(page([]))),
    http.get('*/api/movements/performers', () => HttpResponse.json({ items: [] })),
    http.get('*/api/users', () => HttpResponse.json(page([]))),
  );
}

async function violations() {
  const result = await axe.run(document, { rules: { 'color-contrast': { enabled: false } } });
  return result.violations.map((v) => {
    const where = v.nodes
      .slice(0, 3)
      .map((node) => node.target.join(' '))
      .join(' | ');
    return `${v.id} [${v.impact}] x${v.nodes.length}: ${v.help}. e.g. ${where}`;
  });
}

const PUBLIC = [
  ['/login', 'sign in'],
  ['/register', 'sign up'],
  ['/forgot-password', 'forgot password'],
  ['/reset-password?token=abc', 'reset password'],
  ['/no-such-page', 'not found'],
];
const APP = [
  ['/', 'dashboard'],
  ['/products', 'products'],
  ['/movements', 'movements'],
  ['/categories', 'categories'],
  ['/suppliers', 'suppliers'],
  ['/users', 'users'],
  ['/profile', 'profile'],
];

describe.each([['en'], ['fa']])('accessibility (axe) in %s', (language) => {
  it.each(PUBLIC)('public page %s (%s) has no violations', async (route) => {
    await i18n.changeLanguage(language);
    renderApp({ route });
    await screen.findByRole('heading');
    expect(await violations()).toEqual([]);
  });

  it.each([
    ['/awaiting-approval', 'awaiting approval', { status: 'pending', role: 'staff' }],
    ['/complete-profile', 'complete profile', { status: 'pending', profileComplete: false }],
  ])('page %s (%s) has no violations', async (route, _name, fields) => {
    const me = { ...activeUser, ...fields };
    server.use(http.get('*/api/auth/me', () => HttpResponse.json({ user: me })));
    await i18n.changeLanguage(language);
    renderApp({ route });
    await screen.findByRole('heading');
    expect(await violations()).toEqual([]);
  });

  it.each([
    ['/confirm-link?token=abc', 'confirm account link'],
    ['/verify-email?token=abc', 'verify email'],
  ])('email-link page %s (%s) has no violations', async (route) => {
    server.use(
      http.post('*/api/auth/verify-email', () =>
        HttpResponse.json({ message: 'Email verified. Return to the app or log in.' }),
      ),
    );
    await i18n.changeLanguage(language);
    renderApp({ route });
    await screen.findByRole('heading');
    await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull());
    expect(await violations()).toEqual([]);
  });

  describe.each([
    [true, 'with data'],
    [false, 'empty'],
  ])('signed in, %s', (withData) => {
    it.each(APP)('page %s (%s) has no violations', async (route) => {
      signedIn(withData);
      await i18n.changeLanguage(language);
      renderApp({ route });
      await waitFor(() => expect(document.querySelector('main, [role="main"]')).not.toBeNull());
      // Let the page's own requests finish, so a list is judged with its rows or empty state.
      await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull());
      expect(await violations()).toEqual([]);
    });
  });
});
