import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { activeUser, server } from '@/test/server';

const admin = { ...activeUser, id: 'a1', name: 'Ana Admin', role: 'admin' };
const staff = { ...activeUser, id: 's1', name: 'Sam Staff', role: 'staff' };

const supplier = (fields) => ({
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  isActive: true,
  productCount: 0,
  movementCount: 0,
  ...fields,
});
const acme = supplier({
  id: 'p1',
  name: 'Acme Tools',
  contactPerson: 'Rita Roe',
  phone: '555-0100',
  email: 'rita@acme.test',
  productCount: 2,
  movementCount: 14,
});
const northwind = supplier({ id: 'p2', name: 'Northwind Freight' });
const oldMill = supplier({ id: 'p3', name: 'Old Mill Paper Co.', isActive: false });

/** An in-memory Suppliers API that follows sub-PRD 05 section 5. Records every request. */
function suppliersApi(initial, { me = admin } = {}) {
  const state = { items: [...initial], writes: [], lists: [], failNext: null, failList: false };

  function fail() {
    const failure = state.failNext;
    state.failNext = null;
    return HttpResponse.json(failure.body, { status: failure.status });
  }

  server.use(
    http.get('*/api/auth/me', () => HttpResponse.json({ user: me })),
    http.get('*/api/users/pending-count', () => HttpResponse.json({ count: 0 })),
    http.get('*/api/suppliers', ({ request }) => {
      const query = Object.fromEntries(new URL(request.url).searchParams);
      state.lists.push(query);
      if (state.failList) return HttpResponse.json({ message: 'boom' }, { status: 500 });
      const limit = Number(query.limit);
      const page = Number(query.page || 1);
      const items = state.items.slice((page - 1) * limit, page * limit);
      return HttpResponse.json({ items, total: state.items.length, page, limit });
    }),
    http.post('*/api/suppliers', async ({ request }) => {
      const body = await request.json();
      state.writes.push({ method: 'POST', body });
      if (state.failNext) return fail();
      const created = supplier({ id: `p${state.items.length + 10}`, ...body });
      state.items = [...state.items, created];
      return HttpResponse.json({ supplier: created }, { status: 201 });
    }),
    http.patch('*/api/suppliers/:id', async ({ params, request }) => {
      const body = await request.json();
      state.writes.push({ method: 'PATCH', id: params.id, body });
      if (state.failNext) return fail();
      state.items = state.items.map((item) =>
        item.id === params.id ? { ...item, ...body } : item,
      );
      return HttpResponse.json({ supplier: state.items.find((item) => item.id === params.id) });
    }),
    http.delete('*/api/suppliers/:id', ({ params }) => {
      state.writes.push({ method: 'DELETE', id: params.id });
      if (state.failNext) return fail();
      state.items = state.items.filter((item) => item.id !== params.id);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return state;
}

const row = async (name) => {
  const link = await screen.findByRole('link', { name });
  return link.closest('tr');
};
const lastList = (state) => state.lists.at(-1);

describe('Suppliers page', () => {
  it('lists suppliers with their contact details and product counts', async () => {
    suppliersApi([acme, northwind]);
    renderApp({ route: '/suppliers' });

    const acmeRow = await row('Acme Tools');
    expect(within(acmeRow).getByText('Rita Roe')).toBeInTheDocument();
    expect(within(acmeRow).getByText('555-0100')).toBeInTheDocument();
    expect(within(acmeRow).getByText('rita@acme.test')).toBeInTheDocument();
    expect(within(acmeRow).getByText('2')).toBeInTheDocument();
    for (const name of ['Name', 'Contact person', 'Phone', 'Email', 'Product count']) {
      expect(screen.getByRole('columnheader', { name: new RegExp(name) })).toBeInTheDocument();
    }
  });

  it('is in the navigation for admins and staff', async () => {
    for (const me of [admin, staff]) {
      suppliersApi([acme], { me });
      const { unmount } = renderApp({ route: '/suppliers' });
      expect(await screen.findByRole('link', { name: 'Suppliers' })).toBeInTheDocument();
      unmount();
    }
  });

  it('marks inactive suppliers with an Inactive badge', async () => {
    suppliersApi([acme, oldMill]);
    renderApp({ route: '/suppliers' });

    expect(within(await row('Old Mill Paper Co.')).getByText('Inactive')).toBeInTheDocument();
    expect(within(await row('Acme Tools')).queryByText('Inactive')).not.toBeInTheDocument();
  });

  it('links each supplier to the Products page filtered by it', async () => {
    suppliersApi([acme]);
    renderApp({ route: '/suppliers' });

    expect(await screen.findByRole('link', { name: 'Acme Tools' })).toHaveAttribute(
      'href',
      '/products?supplier=p1',
    );
  });

  it('shows staff a read-only table', async () => {
    suppliersApi([acme], { me: staff });
    renderApp({ route: '/suppliers' });

    await screen.findByRole('link', { name: 'Acme Tools' });
    expect(screen.queryByRole('button', { name: 'Add supplier' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Deactivate/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).not.toBeInTheDocument();
  });

  it('searches on the server after a pause and keeps the search in the URL', async () => {
    const state = suppliersApi([acme, northwind]);
    const user = userEvent.setup();
    renderApp({ route: '/suppliers' });
    await screen.findByRole('link', { name: 'Acme Tools' });

    await user.type(screen.getByRole('searchbox', { name: 'Search suppliers' }), 'rita');

    await waitFor(() => expect(lastList(state)).toMatchObject({ search: 'rita', page: '1' }));
  });

  it('reads the search from the URL', async () => {
    const state = suppliersApi([acme]);
    renderApp({ route: '/suppliers?search=acme' });

    await screen.findByRole('link', { name: 'Acme Tools' });
    expect(lastList(state)).toMatchObject({ search: 'acme' });
    expect(screen.getByRole('searchbox', { name: 'Search suppliers' })).toHaveValue('acme');
  });

  it('sorts by name on the server, ascending first, then descending', async () => {
    const state = suppliersApi([acme, northwind]);
    const user = userEvent.setup();
    renderApp({ route: '/suppliers' });
    await screen.findByRole('link', { name: 'Acme Tools' });
    expect(lastList(state)).toMatchObject({ sortBy: 'name', order: 'asc' });

    await user.click(screen.getByRole('button', { name: /Name/ }));

    await waitFor(() => expect(lastList(state)).toMatchObject({ sortBy: 'name', order: 'desc' }));
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });

  it('pages on the server', async () => {
    const many = Array.from({ length: 25 }, (_, index) =>
      supplier({ id: `m${index}`, name: `Supplier ${String(index).padStart(2, '0')}` }),
    );
    const state = suppliersApi(many);
    const user = userEvent.setup();
    renderApp({ route: '/suppliers' });
    await screen.findByRole('link', { name: 'Supplier 00' });
    expect(lastList(state)).toMatchObject({ page: '1', limit: '20' });

    await user.click(screen.getByRole('button', { name: /next/i }));

    expect(await screen.findByRole('link', { name: 'Supplier 20' })).toBeInTheDocument();
    expect(lastList(state)).toMatchObject({ page: '2', limit: '20' });
  });

  it('shows empty states, with and without a search', async () => {
    suppliersApi([]);
    const { unmount } = renderApp({ route: '/suppliers' });
    expect(await screen.findByText('No suppliers yet.')).toBeInTheDocument();
    unmount();

    suppliersApi([]);
    renderApp({ route: '/suppliers?search=zzz' });
    expect(await screen.findByText('No suppliers match your search.')).toBeInTheDocument();
  });

  it('shows a loading state while the list loads', async () => {
    suppliersApi([acme]);
    server.use(http.get('*/api/suppliers', () => new Promise(() => {})));
    renderApp({ route: '/suppliers' });

    expect(await screen.findByRole('status')).toHaveTextContent('Loading…');
  });

  it('shows an error state when the list fails', async () => {
    const state = suppliersApi([acme]);
    state.failList = true;
    renderApp({ route: '/suppliers' });

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

describe('Suppliers page, admin', () => {
  it('adds a supplier from the form and shows it in the table', async () => {
    const state = suppliersApi([acme]);
    const user = userEvent.setup();
    renderApp({ route: '/suppliers' });

    await user.click(await screen.findByRole('button', { name: 'Add supplier' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'Birch Supply');
    await user.type(within(dialog).getByLabelText('Contact person'), 'Bo Birch');
    await user.type(within(dialog).getByLabelText('Email'), 'bo@birch.test');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('link', { name: 'Birch Supply' })).toBeInTheDocument();
    expect(state.writes[0]).toMatchObject({
      method: 'POST',
      body: { name: 'Birch Supply', contactPerson: 'Bo Birch', email: 'bo@birch.test' },
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('requires a name and a valid email before sending anything', async () => {
    const state = suppliersApi([acme]);
    const user = userEvent.setup();
    renderApp({ route: '/suppliers' });

    await user.click(await screen.findByRole('button', { name: 'Add supplier' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Email'), 'not-an-email');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await within(dialog).findByText('Enter a name')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a valid email address')).toBeInTheDocument();
    expect(state.writes).toEqual([]);
  });

  it('shows the duplicate-name message under the name field', async () => {
    const state = suppliersApi([acme]);
    state.failNext = {
      status: 409,
      body: {
        code: 'DUPLICATE_NAME',
        message: 'A supplier with this name already exists',
        errors: { name: 'A supplier with this name already exists' },
      },
    };
    const user = userEvent.setup();
    renderApp({ route: '/suppliers' });

    await user.click(await screen.findByRole('button', { name: 'Add supplier' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'acme tools');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    const message = await within(dialog).findByText('A supplier with this name already exists');
    expect(message).toHaveAttribute('id', 'supplier-name-error');
    expect(within(dialog).getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
  });

  it('edits a supplier, starting from its current values, and can clear a field', async () => {
    const state = suppliersApi([acme]);
    const user = userEvent.setup();
    renderApp({ route: '/suppliers' });

    await user.click(await screen.findByRole('button', { name: 'Edit Acme Tools' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Acme Tools');
    expect(within(dialog).getByLabelText('Phone')).toHaveValue('555-0100');
    await user.clear(within(dialog).getByLabelText('Phone'));
    await user.clear(within(dialog).getByLabelText('Name'));
    await user.type(within(dialog).getByLabelText('Name'), 'Acme Hardware');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('link', { name: 'Acme Hardware' })).toBeInTheDocument();
    expect(state.writes[0]).toMatchObject({
      method: 'PATCH',
      id: 'p1',
      body: { name: 'Acme Hardware', phone: '' },
    });
  });

  it('keeps an inactive supplier editable', async () => {
    suppliersApi([oldMill]);
    const user = userEvent.setup();
    renderApp({ route: '/suppliers' });

    await user.click(await screen.findByRole('button', { name: 'Edit Old Mill Paper Co.' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('asks before deactivating a supplier that still has products', async () => {
    const state = suppliersApi([acme]);
    const user = userEvent.setup();
    renderApp({ route: '/suppliers' });

    await user.click(await screen.findByRole('button', { name: 'Deactivate Acme Tools' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('2 products');
    expect(state.writes).toEqual([]);
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByText('Inactive')).toBeInTheDocument();
    expect(state.writes).toEqual([{ method: 'PATCH', id: 'p1', body: { isActive: false } }]);
  });

  it('does not deactivate when the confirmation is cancelled', async () => {
    const state = suppliersApi([acme]);
    const user = userEvent.setup();
    renderApp({ route: '/suppliers' });

    await user.click(await screen.findByRole('button', { name: 'Deactivate Acme Tools' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
    );

    expect(state.writes).toEqual([]);
    expect(screen.getByRole('button', { name: 'Deactivate Acme Tools' })).toHaveFocus();
  });

  it('deactivates a supplier with no products at once', async () => {
    const state = suppliersApi([northwind]);
    const user = userEvent.setup();
    renderApp({ route: '/suppliers' });

    await user.click(await screen.findByRole('button', { name: 'Deactivate Northwind Freight' }));

    expect(await screen.findByText('Inactive')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(state.writes).toEqual([{ method: 'PATCH', id: 'p2', body: { isActive: false } }]);
  });

  it('reactivates an inactive supplier at once', async () => {
    const state = suppliersApi([oldMill]);
    const user = userEvent.setup();
    renderApp({ route: '/suppliers' });

    await user.click(await screen.findByRole('button', { name: 'Reactivate Old Mill Paper Co.' }));

    await waitFor(() => expect(screen.queryByText('Inactive')).not.toBeInTheDocument());
    expect(state.writes).toEqual([{ method: 'PATCH', id: 'p3', body: { isActive: true } }]);
  });

  it('deletes an unused supplier after a confirmation', async () => {
    const state = suppliersApi([acme, northwind]);
    const user = userEvent.setup();
    renderApp({ route: '/suppliers' });

    const button = await screen.findByRole('button', { name: 'Delete Northwind Freight' });
    expect(button).toBeEnabled();
    await user.click(button);
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Delete Northwind Freight?');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(screen.queryByRole('link', { name: 'Northwind Freight' })).not.toBeInTheDocument(),
    );
    expect(state.writes).toEqual([{ method: 'DELETE', id: 'p2' }]);
  });

  it.each([
    ['products only', { productCount: 2, movementCount: 0 }, 'Used by 2 products. Deactivate'],
    [
      'movements only',
      { productCount: 0, movementCount: 1 },
      'Used by 1 stock movement. Deactivate',
    ],
    [
      'products and movements',
      { productCount: 2, movementCount: 14 },
      'Used by 2 products and 14 stock movements. Deactivate it instead.',
    ],
  ])('disables Delete, and says why, when a supplier has %s', async (_label, counts, reason) => {
    suppliersApi([supplier({ id: 'p9', name: 'Busy Co', ...counts })]);
    renderApp({ route: '/suppliers' });

    const button = await screen.findByRole('button', { name: 'Delete Busy Co' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(expect.stringContaining(reason));
    expect(button.parentElement).toHaveAttribute('title', expect.stringContaining(reason));
  });

  it('shows the counts and refreshes the row when a delete is blocked after all', async () => {
    const state = suppliersApi([northwind]);
    state.failNext = {
      status: 409,
      body: {
        code: 'IN_USE',
        message: 'Used by 1 product and 3 stock movements. Deactivate it instead.',
        details: { productCount: 1, movementCount: 3 },
      },
    };
    const user = userEvent.setup();
    renderApp({ route: '/suppliers' });

    await user.click(await screen.findByRole('button', { name: 'Delete Northwind Freight' }));
    state.items = [{ ...northwind, productCount: 1, movementCount: 3 }];
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Used by 1 product and 3 stock movements. Deactivate it instead.',
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Delete Northwind Freight' })).toBeDisabled(),
    );
  });
});
