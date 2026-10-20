import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { activeUser, server } from '@/test/server';

const admin = { ...activeUser, id: 'a1', name: 'Ana Admin', role: 'admin' };
const staff = { ...activeUser, id: 's1', name: 'Sam Staff', role: 'staff' };

const TOOLS_ID = 'c'.repeat(24);
const PAPER_ID = 'd'.repeat(24);
const ACME_ID = 'a'.repeat(24);

const product = (fields) => ({
  description: '',
  price: 10,
  quantity: 5,
  reorderLevel: 2,
  stockStatus: 'in_stock',
  isArchived: false,
  category: { id: TOOLS_ID, title: 'Tools' },
  supplier: null,
  createdAt: '2026-10-14T10:00:00.000Z',
  ...fields,
});
const hammer = product({
  id: 'p1',
  title: 'Claw Hammer',
  sku: 'HAM-001',
  price: 12.5,
  quantity: 40,
  supplier: { id: ACME_ID, name: 'Acme Tools' },
});
const glue = product({
  id: 'p2',
  title: 'Wood Glue',
  sku: 'GLU-002',
  quantity: 0,
  stockStatus: 'out_of_stock',
  category: { id: PAPER_ID, title: 'Paper' },
});
const oldLamp = product({
  id: 'p3',
  title: 'Old Lamp',
  sku: 'LMP-003',
  quantity: 1,
  reorderLevel: 3,
  stockStatus: 'low_stock',
  isArchived: true,
});

/** A Products API that records every list request; the filtering itself is the server's job. */
function productsApi(items, { me = admin, failList = false } = {}) {
  const state = { lists: [] };
  server.use(
    http.get('*/api/auth/me', () => HttpResponse.json({ user: me })),
    http.get('*/api/users/pending-count', () => HttpResponse.json({ count: 0 })),
    http.get('*/api/categories', () =>
      HttpResponse.json({
        items: [
          { id: TOOLS_ID, title: 'Tools' },
          { id: PAPER_ID, title: 'Paper' },
        ],
      }),
    ),
    http.get('*/api/suppliers', () =>
      HttpResponse.json({
        items: [{ id: ACME_ID, name: 'Acme Tools' }],
        total: 1,
        page: 1,
        limit: 100,
      }),
    ),
    http.get('*/api/products', ({ request }) => {
      state.lists.push(Object.fromEntries(new URL(request.url).searchParams));
      if (failList) return HttpResponse.json({ message: 'boom' }, { status: 500 });
      return HttpResponse.json({ items, total: items.length, page: 1, limit: 20 });
    }),
  );
  return state;
}

const row = async (title) => (await screen.findByText(title)).closest('tr');
const lastList = (state) => state.lists.at(-1);

/** Opens a filter select and picks an option (Radix Select renders its options in a portal). */
async function choose(user, label, option) {
  await user.click(screen.getByRole('combobox', { name: label }));
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('Products page', () => {
  it('lists products with SKU, category, supplier, price, quantity, status and created date', async () => {
    productsApi([hammer, glue]);
    renderApp({ route: '/products' });

    const hammerRow = await row('Claw Hammer');
    expect(within(hammerRow).getByText('HAM-001')).toBeInTheDocument();
    expect(within(hammerRow).getByText('Tools')).toBeInTheDocument();
    expect(within(hammerRow).getByText('Acme Tools')).toBeInTheDocument();
    expect(within(hammerRow).getByText('$12.50')).toBeInTheDocument();
    expect(within(hammerRow).getByText('40')).toBeInTheDocument();
    expect(within(hammerRow).getByText('In stock')).toBeInTheDocument();
    expect(within(hammerRow).getByText('Oct 14, 2026')).toBeInTheDocument();

    const glueRow = await row('Wood Glue');
    expect(within(glueRow).getByText('Out of stock')).toBeInTheDocument();
    expect(within(glueRow).getByText('—')).toBeInTheDocument();
    for (const name of ['Title', 'Category', 'Supplier', 'Price', 'Quantity', 'Stock status']) {
      expect(screen.getByRole('columnheader', { name: new RegExp(name) })).toBeInTheDocument();
    }
    expect(screen.getByRole('heading', { level: 1, name: 'Products' })).toBeInTheDocument();
  });

  it('has no Add, Edit or Archive actions yet', async () => {
    productsApi([hammer]);
    renderApp({ route: '/products' });

    await row('Claw Hammer');
    expect(screen.queryByRole('button', { name: /add product/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit|archive/i })).not.toBeInTheDocument();
  });

  it('marks archived products with an Archived badge', async () => {
    productsApi([hammer, oldLamp]);
    renderApp({ route: '/products?archived=true' });

    expect(within(await row('Old Lamp')).getByText('Archived')).toBeInTheDocument();
    expect(within(await row('Claw Hammer')).queryByText('Archived')).not.toBeInTheDocument();
  });

  it('starts from the URL: filters are sent to the API and shown in the controls', async () => {
    const state = productsApi([hammer]);
    renderApp({
      route: `/products?search=ham&category=${TOOLS_ID}&supplier=${ACME_ID}&status=low_stock&sortBy=price&order=desc&page=2&limit=50`,
    });

    await row('Claw Hammer');
    expect(lastList(state)).toEqual({
      search: 'ham',
      category: TOOLS_ID,
      supplier: ACME_ID,
      status: 'low_stock',
      sortBy: 'price',
      order: 'desc',
      page: '2',
      limit: '50',
    });
    expect(screen.getByRole('searchbox', { name: 'Search products' })).toHaveValue('ham');
    expect(screen.getByRole('combobox', { name: 'Category' })).toHaveTextContent('Tools');
    expect(screen.getByRole('combobox', { name: 'Supplier' })).toHaveTextContent('Acme Tools');
    expect(screen.getByRole('combobox', { name: 'Stock status' })).toHaveTextContent('Low stock');
  });

  it('falls back to the defaults for values that make no sense', async () => {
    const state = productsApi([hammer]);
    renderApp({
      route:
        '/products?category=nope&supplier=1&status=bogus&sortBy=cost&order=sideways&page=-3&limit=7',
    });

    await row('Claw Hammer');
    expect(lastList(state)).toEqual({ sortBy: 'title', order: 'asc', page: '1', limit: '20' });
  });

  it('searches after a pause and starts again from the first page', async () => {
    const state = productsApi([hammer]);
    const user = userEvent.setup();
    renderApp({ route: '/products?page=3' });

    await row('Claw Hammer');
    await user.type(screen.getByRole('searchbox', { name: 'Search products' }), 'glue');

    await waitFor(() => expect(lastList(state)).toMatchObject({ search: 'glue', page: '1' }));
    // Typing four letters does not send four requests: only the settled text is searched.
    expect(state.lists.filter((list) => list.search).map((list) => list.search)).toEqual(['glue']);
  });

  it('filters by category, supplier and stock status', async () => {
    const state = productsApi([hammer]);
    const user = userEvent.setup();
    renderApp({ route: '/products' });

    await row('Claw Hammer');
    await choose(user, 'Category', 'Paper');
    await waitFor(() => expect(lastList(state)).toMatchObject({ category: PAPER_ID }));
    await choose(user, 'Supplier', 'Acme Tools');
    await waitFor(() => expect(lastList(state)).toMatchObject({ supplier: ACME_ID }));
    await choose(user, 'Stock status', 'Out of stock');
    await waitFor(() => expect(lastList(state)).toMatchObject({ status: 'out_of_stock' }));
    expect(lastList(state)).toMatchObject({ category: PAPER_ID, supplier: ACME_ID });

    await choose(user, 'Stock status', 'All stock statuses');
    await waitFor(() => expect(lastList(state).status).toBeUndefined());
  });

  it('sorts on the server by title, price and quantity', async () => {
    const state = productsApi([hammer]);
    const user = userEvent.setup();
    renderApp({ route: '/products' });

    await row('Claw Hammer');
    expect(lastList(state)).toMatchObject({ sortBy: 'title', order: 'asc' });

    await user.click(screen.getByRole('button', { name: /^Price/ }));
    await waitFor(() => expect(lastList(state)).toMatchObject({ sortBy: 'price', order: 'asc' }));
    await user.click(screen.getByRole('button', { name: /^Price/ }));
    await waitFor(() => expect(lastList(state)).toMatchObject({ sortBy: 'price', order: 'desc' }));
    await user.click(screen.getByRole('button', { name: /^Quantity/ }));
    await waitFor(() => expect(lastList(state)).toMatchObject({ sortBy: 'quantity' }));

    expect(screen.queryByRole('button', { name: /^Category/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Stock status/ })).not.toBeInTheDocument();
  });

  it('lets admins include archived products', async () => {
    const state = productsApi([hammer]);
    const user = userEvent.setup();
    renderApp({ route: '/products' });

    await row('Claw Hammer');
    expect(lastList(state).archived).toBeUndefined();
    await user.click(screen.getByRole('checkbox', { name: 'Show archived' }));

    await waitFor(() => expect(lastList(state)).toMatchObject({ archived: 'true' }));
  });

  it('never asks the API for archived products on behalf of staff', async () => {
    const state = productsApi([hammer], { me: staff });
    renderApp({ route: '/products?archived=true' });

    await row('Claw Hammer');
    expect(screen.queryByRole('checkbox', { name: 'Show archived' })).not.toBeInTheDocument();
    expect(state.lists.every((list) => list.archived === undefined)).toBe(true);
  });

  it('shows how many products there are and pages through them', async () => {
    const state = productsApi([hammer, glue]);
    renderApp({ route: '/products' });

    await row('Claw Hammer');
    expect(lastList(state)).toMatchObject({ page: '1', limit: '20' });
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });

  it('clears every filter at once', async () => {
    const state = productsApi([hammer]);
    const user = userEvent.setup();
    renderApp({ route: `/products?search=ham&category=${TOOLS_ID}&status=low_stock` });

    await row('Claw Hammer');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() =>
      expect(lastList(state)).toEqual({ sortBy: 'title', order: 'asc', page: '1', limit: '20' }),
    );
    expect(screen.getByRole('searchbox', { name: 'Search products' })).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('says so when nothing matches, and when there are no products at all', async () => {
    productsApi([]);
    const { unmount } = renderApp({ route: '/products?search=zzz' });
    expect(await screen.findByText('No products match your filters.')).toBeInTheDocument();
    unmount();

    productsApi([]);
    renderApp({ route: '/products' });
    expect(await screen.findByText('No products yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('shows an error when the products cannot be loaded', async () => {
    productsApi([], { failList: true });
    renderApp({ route: '/products' });

    expect(await screen.findByRole('alert')).toHaveTextContent('boom');
  });

  it('wraps a very long title and SKU instead of overflowing', async () => {
    const title = `Heavy-duty ${'x'.repeat(120)}`;
    const sku = 'S'.repeat(60);
    productsApi([product({ id: 'p9', title, sku })]);
    renderApp({ route: '/products' });

    expect((await screen.findByText(title)).className).toContain('[overflow-wrap:anywhere]');
    expect(screen.getByText(sku).className).toContain('[overflow-wrap:anywhere]');
  });
});
