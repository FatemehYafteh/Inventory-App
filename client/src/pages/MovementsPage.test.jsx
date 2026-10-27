import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { activeUser, server } from '@/test/server';

const admin = { ...activeUser, id: 'a1', name: 'Ana Admin', role: 'admin' };
const staff = { ...activeUser, id: 's1', name: 'Sam Staff', role: 'staff' };

const ACME_ID = 'a'.repeat(24);
const ANA_ID = '1'.repeat(24);
const SAM_ID = '2'.repeat(24);
const HAMMER_ID = 'b'.repeat(24);
const GLUE_ID = 'c'.repeat(24);

const hammer = { id: HAMMER_ID, title: 'Claw Hammer', sku: 'HAM-001' };
const glue = { id: GLUE_ID, title: 'Wood Glue', sku: 'GLU-002' };

const received = {
  id: 'm1',
  product: hammer,
  type: 'receive',
  quantityChange: 40,
  quantityBefore: 0,
  quantityAfter: 40,
  supplier: { id: ACME_ID, name: 'Acme Tools' },
  note: 'Initial stock',
  performedBy: { id: ANA_ID, name: 'Ana Admin', role: 'admin' },
  createdAt: '2026-10-14T10:30:00.000Z',
};
const shipped = {
  id: 'm2',
  product: glue,
  type: 'ship',
  quantityChange: -3,
  quantityBefore: 5,
  quantityAfter: 2,
  supplier: null,
  note: '',
  performedBy: { id: SAM_ID, name: 'Sam Staff', role: 'staff' },
  createdAt: '2026-10-15T08:00:00.000Z',
};

/** A Movements API that records every list request; the filtering itself is the server's job. */
function movementsApi(items, { me = admin, fail = false } = {}) {
  const state = { queries: [] };
  server.use(
    http.get('*/api/auth/me', () => HttpResponse.json({ user: me })),
    http.get('*/api/movements/performers', () =>
      HttpResponse.json({
        items: [
          { id: ANA_ID, name: 'Ana Admin' },
          { id: SAM_ID, name: 'Sam Staff' },
        ],
      }),
    ),
    http.get('*/api/movements', ({ request }) => {
      const query = Object.fromEntries(new URL(request.url).searchParams);
      state.queries.push(query);
      if (fail) return HttpResponse.json({ message: 'boom' }, { status: 500 });
      return HttpResponse.json({
        items,
        total: items.length,
        page: Number(query.page ?? 1),
        limit: Number(query.limit ?? 20),
      });
    }),
    http.get('*/api/suppliers', () =>
      HttpResponse.json({
        items: [{ id: ACME_ID, name: 'Acme Tools', isActive: true }],
        total: 1,
        page: 1,
        limit: 100,
      }),
    ),
    http.get('*/api/products/:id', ({ params }) => {
      const found = [hammer, glue].find((item) => item.id === params.id);
      return found
        ? HttpResponse.json({ product: found })
        : HttpResponse.json({ message: 'Product not found' }, { status: 404 });
    }),
    http.get('*/api/products', ({ request }) => {
      const search = new URL(request.url).searchParams.get('search') ?? '';
      const found = [hammer, glue].filter((item) =>
        item.title.toLowerCase().includes(search.toLowerCase()),
      );
      return HttpResponse.json({ items: found, total: found.length, page: 1, limit: 20 });
    }),
  );
  return state;
}

const lastQuery = (state) => state.queries[state.queries.length - 1];

describe('MovementsPage', () => {
  it('shows every movement with its product, supplier, note and who made it', async () => {
    movementsApi([received, shipped]);
    renderApp({ route: '/movements' });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Stock movements' }),
    ).toBeInTheDocument();
    const rows = await screen.findAllByRole('row');
    const first = within(rows[1]);
    expect(first.getByText('Claw Hammer')).toBeInTheDocument();
    expect(first.getByText('HAM-001')).toBeInTheDocument();
    expect(first.getByText('Receive')).toBeInTheDocument();
    expect(first.getByText('+40')).toBeInTheDocument();
    expect(first.getByText('Acme Tools')).toBeInTheDocument();
    expect(first.getByText('Initial stock')).toBeInTheDocument();
    expect(first.getByText('Ana Admin')).toBeInTheDocument();
    expect(first.getByText('admin')).toBeInTheDocument();

    const second = within(rows[2]);
    expect(second.getByText('Ship')).toBeInTheDocument();
    expect(second.getByText('−3')).toBeInTheDocument();
    expect(second.getByText('Sam Staff')).toBeInTheDocument();
    expect(second.getByText('staff')).toBeInTheDocument();
  });

  it('opens already filtered from a link, such as the Users drawer', async () => {
    const state = movementsApi([shipped]);
    renderApp({ route: `/movements?user=${SAM_ID}&type=ship` });

    await waitFor(() => expect(lastQuery(state)).toMatchObject({ user: SAM_ID, type: 'ship' }));
    expect(await screen.findByRole('combobox', { name: 'Performed by' })).toHaveTextContent(
      'Sam Staff',
    );
    expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent('Ship');
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeEnabled();
  });

  it('ignores values in the URL that make no sense', async () => {
    const state = movementsApi([]);
    renderApp({ route: '/movements?user=nope&type=sell&to=2026-10-15T00:00:00.000Z&page=-3' });

    await waitFor(() => expect(state.queries.length).toBeGreaterThan(0));
    expect(lastQuery(state)).toEqual({ page: '1', limit: '20' });
  });

  it('filters by type and supplier and sends them to the API', async () => {
    const user = userEvent.setup();
    const state = movementsApi([received]);
    renderApp({ route: '/movements' });
    await screen.findByText('Claw Hammer');

    await user.click(screen.getByRole('combobox', { name: 'Type' }));
    await user.click(await screen.findByRole('option', { name: 'Receive' }));
    await waitFor(() => expect(lastQuery(state)).toMatchObject({ type: 'receive' }));

    await user.click(screen.getByRole('combobox', { name: 'Supplier' }));
    await user.click(await screen.findByRole('option', { name: 'Acme Tools' }));
    await waitFor(() =>
      expect(lastQuery(state)).toMatchObject({ type: 'receive', supplier: ACME_ID }),
    );

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(lastQuery(state)).toEqual({ page: '1', limit: '20' }));
  });

  it('searches products on the server and filters by the chosen one', async () => {
    const user = userEvent.setup();
    const state = movementsApi([shipped]);
    renderApp({ route: '/movements' });
    await screen.findByText('Wood Glue');

    await user.click(screen.getByRole('combobox', { name: 'Product' }));
    await user.type(await screen.findByPlaceholderText('Search by title or SKU'), 'glue');
    const option = await screen.findByRole('option', { name: /Wood Glue/ });
    expect(screen.queryByRole('option', { name: /Claw Hammer/ })).not.toBeInTheDocument();
    await user.click(option);

    await waitFor(() => expect(lastQuery(state)).toMatchObject({ product: GLUE_ID }));
    expect(await screen.findByRole('combobox', { name: 'Product' })).toHaveTextContent('Wood Glue');
  });

  it('sends the chosen days as full instants, ending at the start of the day after the last', async () => {
    const user = userEvent.setup();
    const state = movementsApi([received]);
    const start = new Date(2026, 9, 14).toISOString();
    renderApp({ route: `/movements?from=${encodeURIComponent(start)}` });
    await screen.findByText('Claw Hammer');

    await user.click(screen.getByRole('button', { name: 'Dates' }));
    await user.click(await screen.findByRole('button', { name: /October 20th, 2026/ }));

    await waitFor(() =>
      expect(lastQuery(state)).toMatchObject({
        from: start,
        to: new Date(2026, 9, 21).toISOString(),
      }),
    );
    expect(screen.getByRole('button', { name: 'Dates' })).toHaveTextContent(
      'Oct 14, 2026 to Oct 20, 2026',
    );

    await user.click(screen.getByRole('button', { name: 'Clear dates' }));
    await waitFor(() => expect(lastQuery(state).from).toBeUndefined());
    expect(lastQuery(state).to).toBeUndefined();
  });

  it('asks the API for the next page', async () => {
    const user = userEvent.setup();
    const state = movementsApi([received]);
    server.use(
      http.get('*/api/movements', ({ request }) => {
        const query = Object.fromEntries(new URL(request.url).searchParams);
        state.queries.push(query);
        return HttpResponse.json({
          items: [received],
          total: 45,
          page: Number(query.page),
          limit: 20,
        });
      }),
    );
    renderApp({ route: '/movements' });
    await screen.findByText('Claw Hammer');

    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => expect(lastQuery(state)).toMatchObject({ page: '2' }));
  });

  it('shows the empty states', async () => {
    movementsApi([]);
    renderApp({ route: '/movements' });
    expect(await screen.findByText('No stock movements yet.')).toBeInTheDocument();
  });

  it('shows a different empty state when filters hide everything', async () => {
    movementsApi([]);
    renderApp({ route: '/movements?type=ship' });
    expect(await screen.findByText('No movements match these filters.')).toBeInTheDocument();
  });

  it('shows an error when the movements cannot be loaded', async () => {
    movementsApi([], { fail: true });
    renderApp({ route: '/movements' });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('is open to staff and lists Movements in their navigation', async () => {
    movementsApi([shipped], { me: staff });
    renderApp({ route: '/movements' });

    expect(await screen.findByText('Wood Glue')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Movements' })).toBeInTheDocument();
  });
});
