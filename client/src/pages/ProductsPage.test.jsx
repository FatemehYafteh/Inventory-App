import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';
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
  const state = {
    lists: [],
    writes: [],
    failNext: null,
    gate: null,
    movements: [],
    movementQueries: [],
  };
  // The list answers from this copy, which stock changes update, like the real server.
  const live = items.map((item) => ({ ...item }));
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
    http.patch('*/api/products/:id/:action', ({ params }) => {
      state.writes.push({ method: 'PATCH', id: params.id, action: params.action });
      if (state.failNext) {
        return HttpResponse.json(state.failNext.body, { status: state.failNext.status });
      }
      return HttpResponse.json({ product: product({ id: params.id }) });
    }),
    http.get('*/api/products/:id/movements', ({ request }) => {
      const query = Object.fromEntries(new URL(request.url).searchParams);
      state.movementQueries.push(query);
      if (state.movementsFail) return HttpResponse.json({ message: 'boom' }, { status: 500 });
      const page = Number(query.page);
      const limit = Number(query.limit);
      return HttpResponse.json({
        items: state.movements.slice((page - 1) * limit, page * limit),
        total: state.movements.length,
        page,
        limit,
      });
    }),
    http.post('*/api/products/:id/stock', async ({ params, request }) => {
      const body = await request.json();
      state.writes.push({ method: 'POST', id: params.id, action: 'stock', body });
      if (state.gate) await state.gate;
      if (state.failNext) {
        return HttpResponse.json(state.failNext.body, { status: state.failNext.status });
      }
      const item = live.find((entry) => entry.id === params.id);
      const changes = {
        increment: 1,
        decrement: -1,
        receive: body.quantity,
        ship: -body.quantity,
        adjust: body.quantity - item.quantity,
      };
      item.quantity += changes[body.type];
      return HttpResponse.json(
        { product: { id: item.id, quantity: item.quantity } },
        { status: 201 },
      );
    }),
    http.get('*/api/products', ({ request }) => {
      state.lists.push(Object.fromEntries(new URL(request.url).searchParams));
      if (failList) return HttpResponse.json({ message: 'boom' }, { status: 500 });
      return HttpResponse.json({ items: live, total: live.length, page: 1, limit: 20 });
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

  it('gives staff no Archive or Restore action', async () => {
    productsApi([hammer], { me: staff });
    renderApp({ route: '/products' });

    await row('Claw Hammer');
    expect(screen.queryByRole('button', { name: /archive|restore/i })).not.toBeInTheDocument();
  });

  describe('Archive and Restore', () => {
    it('archives only after a confirmation, then reloads the list', async () => {
      const state = productsApi([hammer]);
      const user = userEvent.setup();
      renderApp({ route: '/products' });

      await row('Claw Hammer');
      await user.click(screen.getByRole('button', { name: 'Archive Claw Hammer' }));
      const dialog = await screen.findByRole('alertdialog', { name: 'Archive Claw Hammer?' });
      expect(state.writes).toEqual([]);

      const listsBefore = state.lists.length;
      await user.click(within(dialog).getByRole('button', { name: 'Archive' }));

      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      expect(state.writes).toEqual([{ method: 'PATCH', id: 'p1', action: 'archive' }]);
      await waitFor(() => expect(state.lists.length).toBeGreaterThan(listsBefore));
    });

    it('does nothing when the confirmation is cancelled', async () => {
      const state = productsApi([hammer]);
      const user = userEvent.setup();
      renderApp({ route: '/products' });

      await row('Claw Hammer');
      await user.click(screen.getByRole('button', { name: 'Archive Claw Hammer' }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
      );

      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      expect(state.writes).toEqual([]);
      expect(screen.getByRole('button', { name: 'Archive Claw Hammer' })).toHaveFocus();
    });

    it('restores an archived product straight away', async () => {
      const state = productsApi([hammer, oldLamp]);
      const user = userEvent.setup();
      renderApp({ route: '/products?archived=true' });

      const lamp = await row('Old Lamp');
      expect(within(lamp).queryByRole('button', { name: /^Archive/ })).not.toBeInTheDocument();
      expect(
        within(await row('Claw Hammer')).queryByRole('button', { name: /^Restore/ }),
      ).not.toBeInTheDocument();

      await user.click(within(lamp).getByRole('button', { name: 'Restore Old Lamp' }));

      await waitFor(() =>
        expect(state.writes).toEqual([{ method: 'PATCH', id: 'p3', action: 'restore' }]),
      );
    });

    it('shows the server message when the change is refused', async () => {
      const state = productsApi([hammer]);
      const user = userEvent.setup();
      renderApp({ route: '/products' });
      state.failNext = {
        status: 409,
        body: { message: 'This product is already archived', code: 'ALREADY_ARCHIVED' },
      };

      await row('Claw Hammer');
      await user.click(screen.getByRole('button', { name: 'Archive Claw Hammer' }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Archive' }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'This product is already archived',
      );
    });
  });

  it('marks archived products with an Archived badge', async () => {
    productsApi([hammer, oldLamp]);
    renderApp({ route: '/products?archived=true' });

    expect(within(await row('Old Lamp')).getByText('Archived')).toBeInTheDocument();
    expect(within(await row('Claw Hammer')).queryByText('Archived')).not.toBeInTheDocument();
  });

  // jsdom has no layout, so this guards the structure that keeps rows from shifting: the badge
  // lives in its own fixed-width column for admins, never inside the Title cell.
  it('keeps the Archived badge out of the Title cell, in a fixed-width column of its own', async () => {
    productsApi([hammer, oldLamp]);
    renderApp({ route: '/products?archived=true' });

    const archivedRow = await row('Old Lamp');
    const activeRow = await row('Claw Hammer');
    const titleCell = within(archivedRow).getByText('Old Lamp').closest('td');
    const badge = within(archivedRow).getByText('Archived');

    expect(titleCell).not.toContainElement(badge);
    expect(badge.parentElement).toHaveClass('w-[4.5rem]');
    const slot = within(activeRow).getByText('Claw Hammer').closest('td').nextElementSibling;
    expect(slot.firstElementChild).toHaveClass('w-[4.5rem]');
    expect(slot.firstElementChild).toBeEmptyDOMElement();
    expect(activeRow.cells).toHaveLength(archivedRow.cells.length);
    expect(screen.getByRole('columnheader', { name: 'Archived' })).toBeInTheDocument();
  });

  it('shows no Archived column to staff', async () => {
    productsApi([hammer], { me: staff });
    renderApp({ route: '/products' });

    await row('Claw Hammer');
    expect(screen.queryByRole('columnheader', { name: 'Archived' })).not.toBeInTheDocument();
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

  describe('Inline quantity', () => {
    const stockWrites = (state) => state.writes.filter((write) => write.action === 'stock');

    it('adds and removes one with a single delta request each, and keeps the new quantity', async () => {
      const state = productsApi([hammer], { me: staff });
      const user = userEvent.setup();
      renderApp({ route: '/products' });
      const hammerRow = await row('Claw Hammer');

      await user.click(
        within(hammerRow).getByRole('button', { name: 'Increase quantity of Claw Hammer' }),
      );
      expect(within(hammerRow).getByText('41')).toBeInTheDocument();
      await user.click(
        within(hammerRow).getByRole('button', { name: 'Decrease quantity of Claw Hammer' }),
      );
      await user.click(
        within(hammerRow).getByRole('button', { name: 'Decrease quantity of Claw Hammer' }),
      );

      await waitFor(() => expect(stockWrites(state)).toHaveLength(3));
      expect(stockWrites(state).map((write) => write.body)).toEqual([
        { type: 'increment' },
        { type: 'decrement' },
        { type: 'decrement' },
      ]);
      await waitFor(() => expect(within(hammerRow).getByText('39')).toBeInTheDocument());
    });

    it('turns off - at 0 and both buttons for an archived product', async () => {
      productsApi([glue, oldLamp]);
      renderApp({ route: '/products?archived=true' });

      const glueRow = await row('Wood Glue');
      expect(
        within(glueRow).getByRole('button', { name: 'Decrease quantity of Wood Glue' }),
      ).toBeDisabled();
      expect(
        within(glueRow).getByRole('button', { name: 'Increase quantity of Wood Glue' }),
      ).toBeEnabled();
      const lampRow = await row('Old Lamp');
      expect(
        within(lampRow).getByRole('button', { name: 'Decrease quantity of Old Lamp' }),
      ).toBeDisabled();
      expect(
        within(lampRow).getByRole('button', { name: 'Increase quantity of Old Lamp' }),
      ).toBeDisabled();
    });

    it('queues rapid clicks: the count moves at once and requests go one at a time', async () => {
      const state = productsApi([hammer]);
      let release;
      state.gate = new Promise((resolve) => {
        release = resolve;
      });
      const user = userEvent.setup();
      renderApp({ route: '/products' });
      const hammerRow = await row('Claw Hammer');
      const plus = within(hammerRow).getByRole('button', {
        name: 'Increase quantity of Claw Hammer',
      });

      await user.click(plus);
      await user.click(plus);
      await user.click(plus);

      expect(within(hammerRow).getByText('43')).toBeInTheDocument();
      await waitFor(() => expect(stockWrites(state)).toHaveLength(1));
      release();
      await waitFor(() => expect(stockWrites(state)).toHaveLength(3));
      await waitFor(() => expect(within(hammerRow).getByText('43')).toBeInTheDocument());
    });

    it('rolls back a refused change and shows the message', async () => {
      const state = productsApi([hammer]);
      state.failNext = {
        status: 409,
        body: {
          message: 'Restore this product before changing its stock',
          code: 'PRODUCT_ARCHIVED',
        },
      };
      const user = userEvent.setup();
      renderApp({ route: '/products' });
      const hammerRow = await row('Claw Hammer');

      await user.click(
        within(hammerRow).getByRole('button', { name: 'Increase quantity of Claw Hammer' }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Restore this product before changing its stock',
      );
      await waitFor(() => expect(within(hammerRow).getByText('40')).toBeInTheDocument());
    });
  });

  describe('Adjust stock dialog', () => {
    const dialog = () => within(screen.getByRole('dialog'));

    async function openAdjust(user, title = 'Claw Hammer') {
      await row(title);
      await user.click(screen.getByRole('button', { name: `Adjust stock of ${title}` }));
      await screen.findByRole('dialog', { name: 'Adjust stock' });
    }

    it('receives stock: previews the result, sends the amount and note, then updates the row', async () => {
      const state = productsApi([hammer], { me: staff });
      const user = userEvent.setup();
      renderApp({ route: '/products' });
      await openAdjust(user);

      expect(dialog().getByText(/Current quantity/)).toHaveTextContent('Current quantity: 40');
      await user.type(dialog().getByLabelText('Quantity to add'), '12');
      expect(dialog().getByText(/Current quantity/)).toHaveTextContent('New quantity: 52');
      await user.type(dialog().getByLabelText(/^Note/), 'Truck 7');
      await user.click(dialog().getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(state.writes).toEqual([
        {
          method: 'POST',
          id: 'p1',
          action: 'stock',
          body: { type: 'receive', quantity: 12, note: 'Truck 7' },
        },
      ]);
      expect(within(await row('Claw Hammer')).getByText('52')).toBeInTheDocument();
    });

    it('accepts Persian digits and sends them as Latin ones', async () => {
      const state = productsApi([hammer], { me: staff });
      const user = userEvent.setup();
      renderApp({ route: '/products' });
      await openAdjust(user);

      await user.type(dialog().getByLabelText('Quantity to add'), '۱۲');

      expect(dialog().getByText(/Current quantity/)).toHaveTextContent('New quantity: 52');
      await user.click(dialog().getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(state.writes[0].body).toEqual({ type: 'receive', quantity: 12 });
    });

    it('ships and adjusts, and omits an empty note', async () => {
      const state = productsApi([hammer]);
      const user = userEvent.setup();
      renderApp({ route: '/products' });
      await openAdjust(user);

      await user.click(dialog().getByRole('tab', { name: 'Ship' }));
      await user.type(dialog().getByLabelText('Quantity to remove'), '5');
      expect(dialog().getByText(/Current quantity/)).toHaveTextContent('New quantity: 35');
      await user.click(dialog().getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

      await openAdjust(user);
      await user.click(dialog().getByRole('tab', { name: 'Adjust' }));
      await user.type(dialog().getByLabelText('New quantity'), '100');
      await user.click(dialog().getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

      expect(state.writes.map((write) => write.body)).toEqual([
        { type: 'ship', quantity: 5 },
        { type: 'adjust', quantity: 100 },
      ]);
    });

    it('refuses before sending: nothing entered, shipping too much, adjusting to the same number', async () => {
      const state = productsApi([hammer]);
      const user = userEvent.setup();
      renderApp({ route: '/products' });
      await openAdjust(user);

      await user.click(dialog().getByRole('button', { name: 'Save' }));
      expect(await dialog().findByText('Enter a whole number')).toBeInTheDocument();

      await user.click(dialog().getByRole('tab', { name: 'Ship' }));
      await user.type(dialog().getByLabelText('Quantity to remove'), '41');
      await user.click(dialog().getByRole('button', { name: 'Save' }));
      expect(await dialog().findByText('Only 40 in stock')).toBeInTheDocument();

      await user.click(dialog().getByRole('tab', { name: 'Adjust' }));
      await user.type(dialog().getByLabelText('New quantity'), '40');
      await user.click(dialog().getByRole('button', { name: 'Save' }));
      expect(await dialog().findByText('The quantity is already 40')).toBeInTheDocument();

      await user.click(dialog().getByRole('tab', { name: 'Receive' }));
      await user.type(dialog().getByLabelText('Quantity to add'), '0');
      await user.click(dialog().getByRole('button', { name: 'Save' }));
      expect(await dialog().findByText('Quantity must be at least 1')).toBeInTheDocument();
      expect(state.writes).toEqual([]);
    });

    it('shows a server refusal and keeps the dialog open', async () => {
      const state = productsApi([hammer]);
      const user = userEvent.setup();
      renderApp({ route: '/products' });
      await openAdjust(user);
      state.failNext = {
        status: 400,
        body: { message: 'Not enough stock for this change', code: 'INSUFFICIENT_STOCK' },
      };

      await user.type(dialog().getByLabelText('Quantity to add'), '3');
      await user.click(dialog().getByRole('button', { name: 'Save' }));

      expect(await dialog().findByRole('alert')).toHaveTextContent(
        'Not enough stock for this change',
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('is off for an archived product', async () => {
      productsApi([oldLamp]);
      renderApp({ route: '/products?archived=true' });

      await row('Old Lamp');
      expect(screen.getByRole('button', { name: 'Adjust stock of Old Lamp' })).toBeDisabled();
    });
  });

  describe('Stock history dialog', () => {
    const dialog = () => within(screen.getByRole('dialog'));
    const movement = (n, fields) => ({
      id: `m${n}`,
      type: 'receive',
      quantityChange: 5,
      quantityBefore: 0,
      quantityAfter: 5,
      supplier: null,
      note: '',
      performedBy: { id: 's1', name: 'Sam Staff' },
      createdAt: '2026-10-14T10:30:00.000Z',
      ...fields,
    });

    async function openHistory(user, title = 'Claw Hammer') {
      await row(title);
      await user.click(screen.getByRole('button', { name: `Stock history of ${title}` }));
      await screen.findByRole('dialog', { name: 'Stock history' });
    }

    it('lists the movements with their change, before, after, supplier, note and performer', async () => {
      const state = productsApi([hammer], { me: staff });
      state.movements = [
        movement(2, {
          type: 'ship',
          quantityChange: -2,
          quantityBefore: 5,
          quantityAfter: 3,
          note: 'Order 7',
          performedBy: { id: 'a1', name: 'Ana Admin' },
        }),
        movement(1, { supplier: { id: ACME_ID, name: 'Acme Tools' }, note: 'Initial stock' }),
      ];
      const user = userEvent.setup();
      renderApp({ route: '/products' });
      await openHistory(user);

      const rows = await dialog().findAllByRole('row');
      const [, newest, oldest] = rows.map((r) => within(r));
      expect(newest.getByText('Ship')).toBeInTheDocument();
      expect(newest.getByText('−2')).toBeInTheDocument();
      expect(newest.getByText('Order 7')).toBeInTheDocument();
      expect(newest.getByText('Ana Admin')).toBeInTheDocument();
      expect(oldest.getByText('Receive')).toBeInTheDocument();
      expect(oldest.getByText('+5')).toBeInTheDocument();
      expect(oldest.getByText('Acme Tools')).toBeInTheDocument();
      expect(oldest.getByText('Initial stock')).toBeInTheDocument();
      expect(oldest.getByText('Sam Staff')).toBeInTheDocument();
      expect(oldest.getByText(/Oct 14, 2026/)).toBeInTheDocument();
      expect(state.movementQueries[0]).toEqual({ page: '1', limit: '10' });
    });

    it('pages through a long history', async () => {
      const state = productsApi([hammer]);
      state.movements = Array.from({ length: 12 }, (_, i) =>
        movement(i, { note: `Entry ${i}`, type: 'increment', quantityChange: 1 }),
      );
      const user = userEvent.setup();
      renderApp({ route: '/products' });
      await openHistory(user);

      expect(await dialog().findByText('Entry 0')).toBeInTheDocument();
      await user.click(dialog().getByRole('button', { name: 'Next' }));

      expect(await dialog().findByText('Entry 11')).toBeInTheDocument();
      expect(dialog().queryByText('Entry 0')).not.toBeInTheDocument();
      expect(state.movementQueries.at(-1)).toEqual({ page: '2', limit: '10' });
    });

    it('says so when there are no movements', async () => {
      productsApi([hammer]);
      const user = userEvent.setup();
      renderApp({ route: '/products' });
      await openHistory(user);

      expect(await dialog().findByText('No stock changes yet.')).toBeInTheDocument();
    });

    it('shows an error when the history cannot be loaded, and closes', async () => {
      const state = productsApi([hammer]);
      state.movementsFail = true;
      const user = userEvent.setup();
      renderApp({ route: '/products' });
      await openHistory(user);

      expect(await dialog().findByRole('alert')).toBeInTheDocument();
      await user.click(dialog().getByRole('button', { name: 'Close' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });
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

    it('shows the fields, with an initial quantity of 0', async () => {
      productsApi([hammer]);
      const user = userEvent.setup();
      renderApp({ route: '/products' });
      await openAdd(user);

      for (const label of [
        'Title',
        'SKU',
        'Description',
        'Price',
        'Reorder level',
        'Initial quantity',
      ]) {
        expect(sheet().getByLabelText(label)).toBeInTheDocument();
      }
      expect(sheet().getByRole('combobox', { name: 'Category' })).toBeInTheDocument();
      expect(sheet().getByRole('combobox', { name: 'Supplier' })).toHaveTextContent('No supplier');
      expect(sheet().getByLabelText('Initial quantity')).toHaveValue('0');
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
            initialQuantity: 0,
          },
        },
      ]);
      await waitFor(() => expect(state.lists.length).toBeGreaterThan(listsBefore));
    });

    it('sends the initial quantity, and refuses a negative one before sending', async () => {
      const state = productsApi([hammer]);
      const user = userEvent.setup();
      renderApp({ route: '/products' });
      await openAdd(user);

      await fillRequired(user);
      await user.clear(sheet().getByLabelText('Initial quantity'));
      await user.type(sheet().getByLabelText('Initial quantity'), '-3');
      await user.click(sheet().getByRole('button', { name: 'Save' }));
      expect(
        await sheet().findByText('Initial quantity must be 0 or more', { selector: 'p' }),
      ).toBeInTheDocument();
      expect(state.writes).toEqual([]);

      await user.clear(sheet().getByLabelText('Initial quantity'));
      await user.type(sheet().getByLabelText('Initial quantity'), '8');
      await user.click(sheet().getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(state.writes).toHaveLength(1));
      expect(state.writes[0].body.initialQuantity).toBe(8);
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
      expect(sheet().getByLabelText('Price')).toHaveValue('12.5');
      expect(sheet().queryByLabelText('Initial quantity')).not.toBeInTheDocument();
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

describe('Products page in Persian', () => {
  it('shows quantities, prices, dates and page numbers with Persian digits', async () => {
    productsApi([hammer]);
    await i18n.changeLanguage('fa');
    renderApp({ route: '/products' });

    const hammerRow = within(await row('Claw Hammer'));
    expect(hammerRow.getByText('۴۰')).toBeInTheDocument();
    expect(hammerRow.getByText(/۱۲٫۵۰/)).toBeInTheDocument();
    expect(screen.getByText(/Page ۱ of ۱/)).toBeInTheDocument();
  });
});
