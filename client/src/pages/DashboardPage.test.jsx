import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { activeUser, server } from '@/test/server';

const admin = { ...activeUser, id: 'a1', name: 'Ana Admin', role: 'admin' };
const staff = { ...activeUser, id: 's1', name: 'Sam Staff', role: 'staff' };

const glue = {
  id: 'p2',
  title: 'Wood Glue',
  sku: 'GLU-002',
  quantity: 0,
  reorderLevel: 5,
  stockStatus: 'out_of_stock',
  supplier: null,
};
const hammer = {
  id: 'p1',
  title: 'Claw Hammer',
  sku: 'HAM-001',
  quantity: 2,
  reorderLevel: 10,
  stockStatus: 'low_stock',
  supplier: { id: 'a'.repeat(24), name: 'Acme Tools' },
};
const received = {
  id: 'm1',
  product: { id: 'p1', title: 'Claw Hammer', sku: 'HAM-001' },
  type: 'receive',
  quantityChange: 40,
  quantityBefore: 0,
  quantityAfter: 40,
  supplier: null,
  note: '',
  performedBy: { id: 'u1', name: 'Ana Admin', role: 'admin' },
  createdAt: '2026-10-14T10:30:00.000Z',
};
const shipped = {
  ...received,
  id: 'm2',
  type: 'ship',
  quantityChange: -3,
  performedBy: { id: 'u2', name: 'Sam Staff', role: 'staff' },
};

const manyLow = (i) => ({
  ...hammer,
  id: `low${i}`,
  title: `Item ${i}`,
  sku: `LOW-${i}`,
});

const data = {
  summary: {
    activeProducts: 1234,
    totalUnits: 5678,
    inventoryValue: 98765.5,
    lowStockCount: 1,
    outOfStockCount: 1,
  },
  lowStock: [glue, hammer],
  recentMovements: [received, shipped],
};

function dashboardApi({ me = admin, body = data, pending = 3, fail = false } = {}) {
  const state = { writes: [], dashboardRequests: 0, pendingRequests: 0 };
  server.use(
    http.get('*/api/auth/me', () => HttpResponse.json({ user: me })),
    http.get('*/api/users/pending-count', () => {
      state.pendingRequests += 1;
      return HttpResponse.json({ count: pending });
    }),
    http.get('*/api/dashboard', () => {
      state.dashboardRequests += 1;
      return fail
        ? HttpResponse.json({ message: 'boom' }, { status: 500 })
        : HttpResponse.json(body);
    }),
    http.post('*/api/products/:id/stock', async ({ params, request }) => {
      const body = await request.json();
      state.writes.push({ id: params.id, body });
      return HttpResponse.json(
        {
          product: { id: params.id, quantity: body.quantity },
          movement: { ...received, id: 'new' },
        },
        { status: 201 },
      );
    }),
  );
  return state;
}

describe('DashboardPage', () => {
  it('shows the summary cards with the numbers from the API', async () => {
    dashboardApi();
    renderApp({ route: '/' });

    const summary = await screen.findByLabelText('Inventory summary');
    const card = (label) => within(summary).getByText(label).parentElement;
    expect(within(card('Active products')).getByText('1,234')).toBeInTheDocument();
    expect(within(card('Total units')).getByText('5,678')).toBeInTheDocument();
    expect(within(card('Inventory value')).getByText('$98,765.50')).toBeInTheDocument();
    expect(within(card('Low stock')).getByText('1')).toBeInTheDocument();
    expect(within(card('Out of stock')).getByText('1')).toBeInTheDocument();
  });

  it('lists the products to restock with a status badge, in the order the API gives', async () => {
    dashboardApi();
    renderApp({ route: '/' });

    const heading = await screen.findByRole('heading', { name: 'Needs restocking' });
    const section = within(heading.closest('div').parentElement);
    const items = section.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('Wood Glue')).toBeInTheDocument();
    expect(within(items[0]).getByText('Out of stock')).toBeInTheDocument();
    expect(within(items[0]).getByText('0 in stock, reorder at 5')).toBeInTheDocument();
    expect(within(items[1]).getByText('Claw Hammer')).toBeInTheDocument();
    expect(within(items[1]).getByText('Low stock')).toBeInTheDocument();
    expect(section.getByRole('link', { name: 'View all low stock' })).toHaveAttribute(
      'href',
      '/products?status=low_stock',
    );
    expect(section.getByRole('link', { name: 'View all out of stock' })).toHaveAttribute(
      'href',
      '/products?status=out_of_stock',
    );
  });

  it('caps Needs restocking at 5 rows and says how many more there are', async () => {
    dashboardApi({
      body: { ...data, lowStock: Array.from({ length: 7 }, (_, i) => manyLow(i)) },
    });
    renderApp({ route: '/' });

    const heading = await screen.findByRole('heading', { name: 'Needs restocking' });
    const section = within(heading.closest('div').parentElement);
    const items = section.getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(within(items[0]).getByText('Item 0')).toBeInTheDocument();
    expect(within(items[4]).getByText('Item 4')).toBeInTheDocument();
    expect(section.queryByText('Item 5')).not.toBeInTheDocument();
    expect(section.getByText('+2 more')).toBeInTheDocument();
    // The view-all targets stay: Products filtered to low stock (and out of stock).
    expect(section.getByRole('link', { name: 'View all low stock' })).toHaveAttribute(
      'href',
      '/products?status=low_stock',
    );
  });

  it('shows no overflow text when 5 or fewer products need restocking', async () => {
    dashboardApi({
      body: { ...data, lowStock: Array.from({ length: 5 }, (_, i) => manyLow(i)) },
    });
    renderApp({ route: '/' });

    const heading = await screen.findByRole('heading', { name: 'Needs restocking' });
    const section = within(heading.closest('div').parentElement);
    expect(section.getAllByRole('listitem')).toHaveLength(5);
    expect(section.queryByText(/more$/)).not.toBeInTheDocument();
  });

  it('receives stock for a low-stock product from the dashboard and reloads it', async () => {
    const user = userEvent.setup();
    const state = dashboardApi();
    renderApp({ route: '/' });

    await user.click(await screen.findByRole('button', { name: 'Receive Claw Hammer' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByRole('tab', { name: 'Receive' })).toHaveAttribute('aria-selected', 'true');
    await user.type(dialog.getByLabelText('Quantity to add'), '8');
    const before = state.dashboardRequests;
    await user.click(dialog.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(state.writes).toEqual([{ id: 'p1', body: { type: 'receive', quantity: 8 } }]),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(state.dashboardRequests).toBeGreaterThan(before));
  });

  it('shows the latest movements with who made them, and a link to all of them', async () => {
    dashboardApi();
    renderApp({ route: '/' });

    const heading = await screen.findByRole('heading', { name: 'Recent movements' });
    const section = within(heading.closest('div').parentElement);
    const items = section.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('+40')).toBeInTheDocument();
    expect(within(items[0]).getByText('Receive')).toBeInTheDocument();
    expect(within(items[0]).getByText('admin')).toBeInTheDocument();
    expect(within(items[1]).getByText('−3')).toBeInTheDocument();
    expect(within(items[1]).getByText('Sam Staff')).toBeInTheDocument();
    expect(section.getByRole('link', { name: 'View all movements' })).toHaveAttribute(
      'href',
      '/movements',
    );
  });

  it('caps Recent movements at 5 rows even though the API sends 10', async () => {
    const movements = Array.from({ length: 10 }, (_, i) => ({
      ...received,
      id: `m${i}`,
      product: { ...received.product, title: `Move ${i}` },
    }));
    dashboardApi({ body: { ...data, recentMovements: movements } });
    renderApp({ route: '/' });

    const heading = await screen.findByRole('heading', { name: 'Recent movements' });
    const section = within(heading.closest('div').parentElement);
    const items = section.getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(within(items[0]).getByText(/Move 0/)).toBeInTheDocument();
    expect(within(items[4]).getByText(/Move 4/)).toBeInTheDocument();
    expect(section.queryByText(/Move 5/)).not.toBeInTheDocument();
    expect(section.getByText('The last 5 stock changes.')).toBeInTheDocument();
    expect(section.getByRole('link', { name: 'View all movements' })).toHaveAttribute(
      'href',
      '/movements',
    );
  });

  it('shows the Pending approvals card to admins only', async () => {
    const adminState = dashboardApi({ pending: 3 });
    renderApp({ route: '/' });

    const summary = await screen.findByLabelText('Inventory summary');
    const card = within(summary).getByText('Pending approvals').parentElement;
    expect(within(card).getByText('3')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Review users' })).toHaveAttribute(
      'href',
      '/users?status=pending',
    );
    expect(adminState.pendingRequests).toBeGreaterThan(0);
  });

  it('hides the Pending approvals card from staff and never asks for the count', async () => {
    const state = dashboardApi({ me: staff });
    renderApp({ route: '/' });

    const summary = await screen.findByLabelText('Inventory summary');
    expect(within(summary).queryByText('Pending approvals')).not.toBeInTheDocument();
    expect(state.pendingRequests).toBe(0);
  });

  it('shows the empty states when there is nothing to restock and no movements', async () => {
    dashboardApi({
      body: {
        summary: {
          activeProducts: 0,
          totalUnits: 0,
          inventoryValue: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
        },
        lowStock: [],
        recentMovements: [],
      },
    });
    renderApp({ route: '/' });

    expect(await screen.findByText('Nothing needs restocking.')).toBeInTheDocument();
    expect(screen.getByText('No stock movements yet.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View all low stock' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Inventory summary')).toHaveTextContent('$0.00');
  });

  it('shows an error when the dashboard cannot be loaded', async () => {
    dashboardApi({ fail: true });
    renderApp({ route: '/' });

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByLabelText('Inventory summary')).not.toBeInTheDocument();
  });
});
