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
const OLD_MILL_ID = 'b'.repeat(24);

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
  const state = { lists: [], writes: [], failNext: null };
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
    http.get('*/api/suppliers', ({ request }) => {
      const query = Object.fromEntries(new URL(request.url).searchParams);
      const all = [
        { id: ACME_ID, name: 'Acme Tools', isActive: true },
        { id: OLD_MILL_ID, name: 'Old Mill Paper Co.', isActive: false },
      ];
      const found = query.active === 'true' ? all.filter((item) => item.isActive) : all;
      return HttpResponse.json({ items: found, total: found.length, page: 1, limit: 100 });
    }),
    http.post('*/api/products', async ({ request }) => {
      const body = await request.json();
      state.writes.push({ method: 'POST', body });
      if (state.failNext) {
        return HttpResponse.json(state.failNext.body, { status: state.failNext.status });
      }
      return HttpResponse.json({ product: product({ id: 'new', ...body }) }, { status: 201 });
    }),
    http.patch('*/api/products/:id', async ({ params, request }) => {
      const body = await request.json();
      state.writes.push({ method: 'PATCH', id: params.id, body });
      if (state.failNext) {
        return HttpResponse.json(state.failNext.body, { status: state.failNext.status });
      }
      return HttpResponse.json({ product: product({ id: params.id, ...body }) });
    }),
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

  it('has no Archive action yet', async () => {
    productsApi([hammer]);
    renderApp({ route: '/products' });

    await row('Claw Hammer');
    expect(screen.queryByRole('button', { name: /archive|restore/i })).not.toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeDisabled();
  });

  it('keeps Clear filters visible, disabled until a filter is active', async () => {
    productsApi([hammer]);
    const user = userEvent.setup();
    renderApp({ route: '/products' });

    await row('Claw Hammer');
    const clear = screen.getByRole('button', { name: 'Clear filters' });
    expect(clear).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: 'Show archived' }));
    await waitFor(() => expect(clear).toBeEnabled());
    await user.click(screen.getByRole('checkbox', { name: 'Show archived' }));
    await waitFor(() => expect(clear).toBeDisabled());
  });

  it('keeps Clear filters enabled when Show archived is unchecked but another filter is active', async () => {
    productsApi([hammer]);
    const user = userEvent.setup();
    renderApp({ route: '/products?archived=true&status=low_stock' });

    await row('Claw Hammer');
    await user.click(screen.getByRole('checkbox', { name: 'Show archived' }));

    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Show archived' })).not.toBeChecked(),
    );
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeEnabled();
  });

  it('says so when nothing matches, and when there are no products at all', async () => {
    productsApi([]);
    const { unmount } = renderApp({ route: '/products?search=zzz' });
    expect(await screen.findByText('No products match your filters.')).toBeInTheDocument();
    unmount();

    productsApi([]);
    renderApp({ route: '/products' });
    expect(await screen.findByText('No products yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeDisabled();
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

  describe('Add and Edit form', () => {
    const sheet = () => within(screen.getByRole('dialog'));

    async function openAdd(user) {
      await row('Claw Hammer');
      await user.click(screen.getByRole('button', { name: 'Add Product' }));
      await screen.findByRole('dialog', { name: 'Add product' });
    }

    async function fillRequired(user) {
      await user.type(sheet().getByLabelText('Title'), 'Cable Ties');
      await user.type(sheet().getByLabelText('SKU'), 'cab-010');
      await user.type(sheet().getByLabelText('Price'), '4.5');
      await user.click(sheet().getByRole('combobox', { name: 'Category' }));
      await user.click(await screen.findByRole('option', { name: 'Tools' }));
    }

    it('shows the fields, without a quantity', async () => {
      productsApi([hammer]);
      const user = userEvent.setup();
      renderApp({ route: '/products' });
      await openAdd(user);

      for (const label of ['Title', 'SKU', 'Description', 'Price', 'Reorder level']) {
        expect(sheet().getByLabelText(label)).toBeInTheDocument();
      }
      expect(sheet().getByRole('combobox', { name: 'Category' })).toBeInTheDocument();
      expect(sheet().getByRole('combobox', { name: 'Supplier' })).toHaveTextContent('No supplier');
      expect(sheet().queryByLabelText(/^quantity|initial/i)).not.toBeInTheDocument();
    });

    it('validates before sending anything', async () => {
      const state = productsApi([hammer]);
      const user = userEvent.setup();
      renderApp({ route: '/products' });
      await openAdd(user);

      await user.click(sheet().getByRole('button', { name: 'Save' }));

      for (const message of [
        'Enter a title',
        'Enter a SKU',
        'Choose a category',
        'Enter a price',
      ]) {
        expect(await sheet().findByText(message, { selector: 'p' })).toBeInTheDocument();
      }
      expect(state.writes).toEqual([]);
    });

    it('creates a product with an uppercase SKU, then reloads the list and closes', async () => {
      const state = productsApi([hammer]);
      const user = userEvent.setup();
      renderApp({ route: '/products' });
      await openAdd(user);
      const listsBefore = state.lists.length;

      await fillRequired(user);
      await user.click(sheet().getByRole('combobox', { name: 'Supplier' }));
      await user.click(await screen.findByRole('option', { name: 'Acme Tools' }));
      await user.click(sheet().getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(state.writes).toEqual([
        {
          method: 'POST',
          body: {
            title: 'Cable Ties',
            sku: 'CAB-010',
            description: '',
            category: TOOLS_ID,
            supplier: ACME_ID,
            price: 4.5,
            reorderLevel: 0,
          },
        },
      ]);
      await waitFor(() => expect(state.lists.length).toBeGreaterThan(listsBefore));
    });

    it('sends no supplier as null', async () => {
      const state = productsApi([hammer]);
      const user = userEvent.setup();
      renderApp({ route: '/products' });
      await openAdd(user);

      await fillRequired(user);
      await user.click(sheet().getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(state.writes).toHaveLength(1));
      expect(state.writes[0].body.supplier).toBeNull();
    });

    it('offers only active suppliers for a new product', async () => {
      productsApi([hammer]);
      const user = userEvent.setup();
      renderApp({ route: '/products' });
      await openAdd(user);

      await user.click(sheet().getByRole('combobox', { name: 'Supplier' }));
      expect(await screen.findByRole('option', { name: 'Acme Tools' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: /Old Mill/ })).not.toBeInTheDocument();
    });

    it('puts a duplicate SKU on the SKU field and keeps the form open', async () => {
      const state = productsApi([hammer]);
      const user = userEvent.setup();
      renderApp({ route: '/products' });
      await openAdd(user);
      state.failNext = {
        status: 409,
        body: {
          message: 'SKU already exists',
          code: 'DUPLICATE_SKU',
          errors: { sku: 'This SKU is already used by another product.' },
        },
      };

      await fillRequired(user);
      await user.click(sheet().getByRole('button', { name: 'Save' }));

      expect(
        await sheet().findByText('This SKU is already used by another product.'),
      ).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('shows other server errors above the fields', async () => {
      const state = productsApi([hammer]);
      const user = userEvent.setup();
      renderApp({ route: '/products' });
      await openAdd(user);
      state.failNext = { status: 400, body: { message: 'Choose an active supplier', code: 'X' } };

      await fillRequired(user);
      await user.click(sheet().getByRole('button', { name: 'Save' }));

      expect(await sheet().findByRole('alert')).toHaveTextContent('Choose an active supplier');
    });

    it('edits a product from its row, starting from its current values', async () => {
      const state = productsApi([hammer]);
      const user = userEvent.setup();
      renderApp({ route: '/products' });

      await row('Claw Hammer');
      await user.click(screen.getByRole('button', { name: 'Edit Claw Hammer' }));
      await screen.findByRole('dialog', { name: 'Edit product' });
      expect(sheet().getByLabelText('Title')).toHaveValue('Claw Hammer');
      expect(sheet().getByLabelText('SKU')).toHaveValue('HAM-001');
      expect(sheet().getByLabelText('Price')).toHaveValue(12.5);
      expect(sheet().getByRole('combobox', { name: 'Category' })).toHaveTextContent('Tools');
      expect(sheet().getByRole('combobox', { name: 'Supplier' })).toHaveTextContent('Acme Tools');

      await user.clear(sheet().getByLabelText('Title'));
      await user.type(sheet().getByLabelText('Title'), 'Steel Claw Hammer');
      await user.click(sheet().getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(state.writes).toEqual([
        {
          method: 'PATCH',
          id: 'p1',
          body: {
            title: 'Steel Claw Hammer',
            sku: 'HAM-001',
            description: '',
            category: TOOLS_ID,
            supplier: ACME_ID,
            price: 12.5,
            reorderLevel: 2,
          },
        },
      ]);
    });

    it('lets a product keep its inactive supplier, labelled as inactive', async () => {
      productsApi([
        product({
          id: 'p4',
          title: 'Ream',
          sku: 'REAM-1',
          supplier: { id: OLD_MILL_ID, name: 'Old Mill Paper Co.' },
        }),
      ]);
      const user = userEvent.setup();
      renderApp({ route: '/products' });

      await row('Ream');
      await user.click(screen.getByRole('button', { name: 'Edit Ream' }));

      expect(await sheet().findByRole('combobox', { name: 'Supplier' })).toHaveTextContent(
        'Old Mill Paper Co. (inactive)',
      );
    });

    it('lets staff add and edit, and Cancel closes without saving', async () => {
      const state = productsApi([hammer], { me: staff });
      const user = userEvent.setup();
      renderApp({ route: '/products' });
      await openAdd(user);

      await user.type(sheet().getByLabelText('Title'), 'Draft');
      await user.click(sheet().getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(state.writes).toEqual([]);
      expect(screen.getByRole('button', { name: 'Edit Claw Hammer' })).toBeInTheDocument();
    });
  });
});
