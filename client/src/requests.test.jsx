import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { activeUser, server } from '@/test/server';

/**
 * Counts the API requests a page really makes, so a duplicate fetch or a request per keystroke
 * shows up as a failing number instead of a feeling. Runs the real pages against mock answers.
 */

const admin = { ...activeUser, id: 'a1', name: 'Ana Admin', role: 'admin' };
const TOOLS = { id: 'c'.repeat(24), title: 'Tools' };
const product = (fields) => ({
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
const hammer = product({ id: 'p1', title: 'Claw Hammer', sku: 'HAM-001', quantity: 40 });
const page = (items) => ({ items, total: items.length, page: 1, limit: 20 });

// The real app keeps data fresh for 30 s (lib/queryClient.js); the default of 0 would refetch on every mount.
const productionLikeClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });

let requests = [];
const record = ({ request }) => {
  const url = new URL(request.url);
  requests.push(`${request.method} ${url.pathname}${url.search}`);
};

function mockApi() {
  requests = [];
  server.events.on('request:start', record);
  server.use(
    http.get('*/api/auth/me', () => HttpResponse.json({ user: admin })),
    http.get('*/api/products', () => HttpResponse.json(page([hammer]))),
    http.get('*/api/categories', () =>
      HttpResponse.json({ items: [{ ...TOOLS, description: '', productCount: 1 }] }),
    ),
    http.get('*/api/suppliers', () => HttpResponse.json(page([]))),
  );
}

afterEach(() => server.events.removeListener('request:start', record));

const counts = () => {
  const map = new Map();
  for (const key of requests) map.set(key, (map.get(key) ?? 0) + 1);
  return map;
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 400));

describe('API requests per page', () => {
  it('the Products page asks for each thing once', async () => {
    mockApi();
    renderApp({ route: '/products', queryClient: productionLikeClient() });
    await screen.findByText('Claw Hammer');
    await settle();

    const duplicated = [...counts()].filter(([, count]) => count > 1);
    expect(duplicated, `all requests: ${requests.join(' | ')}`).toEqual([]);
  });

  it('the Dashboard asks for each thing once', async () => {
    mockApi();
    renderApp({ route: '/', queryClient: productionLikeClient() });
    await screen.findByRole('main');
    await settle();

    const duplicated = [...counts()].filter(([, count]) => count > 1);
    expect(duplicated, `all requests: ${requests.join(' | ')}`).toEqual([]);
  });

  it('fast typing in search sends one list request for the final text, not one per key', async () => {
    mockApi();
    const user = userEvent.setup();
    renderApp({ route: '/products', queryClient: productionLikeClient() });
    await screen.findByText('Claw Hammer');
    await settle();
    const before = requests.length;

    await user.type(screen.getByRole('searchbox', { name: 'Search products' }), 'hammer');
    await waitFor(() =>
      expect(requests.slice(before).some((r) => r.includes('search=hammer'))).toBe(true),
    );
    await settle();

    const listCalls = requests.slice(before).filter((r) => r.startsWith('GET /api/products?'));
    expect(listCalls, `list requests after typing: ${listCalls.join(' | ')}`).toHaveLength(1);
    expect(listCalls[0]).toContain('search=hammer');
  });

  it('changing a filter reloads only the product list, not the categories or suppliers', async () => {
    mockApi();
    const user = userEvent.setup();
    renderApp({ route: '/products', queryClient: productionLikeClient() });
    await screen.findByText('Claw Hammer');
    await settle();
    const before = requests.length;

    await user.type(screen.getByRole('searchbox', { name: 'Search products' }), 'saw');
    await waitFor(() => expect(requests.slice(before).length).toBeGreaterThan(0));
    await settle();

    const after = requests.slice(before);
    expect(after.every((r) => r.startsWith('GET /api/products?'))).toBe(true);
  });
});
