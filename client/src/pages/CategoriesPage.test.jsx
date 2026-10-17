import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { activeUser, server } from '@/test/server';

const admin = { ...activeUser, id: 'a1', name: 'Ana Admin', role: 'admin' };
const staff = { ...activeUser, id: 's1', name: 'Sam Staff', role: 'staff' };

const tools = { id: 'c1', title: 'Tools', description: 'Hand tools', productCount: 3 };
const books = { id: 'c2', title: 'Books', description: '', productCount: 0 };

/** An in-memory Categories API that follows sub-PRD 05 section 5. Records every write. */
function categoriesApi(initial, { me = admin } = {}) {
  const state = { items: [...initial], writes: [], failNext: null, failList: false };

  function fail() {
    const failure = state.failNext;
    state.failNext = null;
    return HttpResponse.json(failure.body, { status: failure.status });
  }

  server.use(
    http.get('*/api/auth/me', () => HttpResponse.json({ user: me })),
    http.get('*/api/users/pending-count', () => HttpResponse.json({ count: 0 })),
    http.get('*/api/categories', () => {
      if (state.failList) return HttpResponse.json({ message: 'boom' }, { status: 500 });
      return HttpResponse.json({ items: state.items });
    }),
    http.post('*/api/categories', async ({ request }) => {
      const body = await request.json();
      state.writes.push({ method: 'POST', body });
      if (state.failNext) return fail();
      const category = { id: `c${state.items.length + 10}`, productCount: 0, ...body };
      state.items = [...state.items, category];
      return HttpResponse.json({ category }, { status: 201 });
    }),
    http.patch('*/api/categories/:id', async ({ params, request }) => {
      const body = await request.json();
      state.writes.push({ method: 'PATCH', id: params.id, body });
      if (state.failNext) return fail();
      state.items = state.items.map((item) =>
        item.id === params.id ? { ...item, ...body } : item,
      );
      return HttpResponse.json({ category: state.items.find((item) => item.id === params.id) });
    }),
    http.delete('*/api/categories/:id', ({ params }) => {
      state.writes.push({ method: 'DELETE', id: params.id });
      if (state.failNext) return fail();
      state.items = state.items.filter((item) => item.id !== params.id);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return state;
}

const card = async (title) => {
  const link = await screen.findByRole('link', { name: new RegExp(title) });
  return link.closest('[data-testid="category-card"]');
};

describe('Categories page', () => {
  it('shows every category as a card with its description and product count', async () => {
    categoriesApi([tools, books]);
    renderApp({ route: '/categories' });

    const toolsCard = await card('Tools');
    expect(within(toolsCard).getByText('Hand tools')).toBeInTheDocument();
    expect(within(toolsCard).getByText('3 products')).toBeInTheDocument();
    expect(within(await card('Books')).getByText('0 products')).toBeInTheDocument();
  });

  it('links each card to the Products page filtered by that category', async () => {
    categoriesApi([tools]);
    renderApp({ route: '/categories' });

    const link = await screen.findByRole('link', { name: /Tools/ });
    expect(link).toHaveAttribute('href', '/products?category=c1');
  });

  it('is in the navigation for admins and staff', async () => {
    categoriesApi([tools], { me: staff });
    renderApp({ route: '/' });

    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Categories' })).toHaveAttribute(
      'href',
      '/categories',
    );
  });

  it('shows staff plain cards with no add, edit or delete', async () => {
    categoriesApi([tools], { me: staff });
    renderApp({ route: '/categories' });

    await card('Tools');
    expect(screen.queryByRole('button', { name: /Add category/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
  });

  it('shows empty and error states', async () => {
    const state = categoriesApi([]);
    const { unmount } = renderApp({ route: '/categories' });
    expect(await screen.findByText('No categories yet.')).toBeInTheDocument();
    unmount();

    state.failList = true;
    renderApp({ route: '/categories' });
    expect(await screen.findByRole('alert')).toHaveTextContent(/Something went wrong/);
  });

  it('shows a loading state before the list arrives', async () => {
    categoriesApi([tools]);
    renderApp({ route: '/categories' });

    expect(await screen.findByRole('status')).toHaveTextContent('Loading categories');
    await card('Tools');
  });
});

describe('Categories page, admin', () => {
  it('adds a category from the form', async () => {
    const state = categoriesApi([tools]);
    const user = userEvent.setup();
    renderApp({ route: '/categories' });

    await user.click(await screen.findByRole('button', { name: 'Add category' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add category' });
    await user.type(within(dialog).getByLabelText('Title'), 'Books');
    await user.type(within(dialog).getByLabelText('Description'), 'Paperbacks');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await card('Books')).toBeInTheDocument();
    expect(state.writes).toEqual([
      { method: 'POST', body: { title: 'Books', description: 'Paperbacks' } },
    ]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('requires a title before sending anything', async () => {
    const state = categoriesApi([tools]);
    const user = userEvent.setup();
    renderApp({ route: '/categories' });

    await user.click(await screen.findByRole('button', { name: 'Add category' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await within(dialog).findByText('Enter a title')).toBeInTheDocument();
    expect(state.writes).toEqual([]);
  });

  it('shows the duplicate-title message under the title field', async () => {
    const state = categoriesApi([tools]);
    state.failNext = {
      status: 409,
      body: {
        code: 'DUPLICATE_NAME',
        message: 'A category with this title already exists',
        errors: { title: 'A category with this title already exists' },
      },
    };
    const user = userEvent.setup();
    renderApp({ route: '/categories' });

    await user.click(await screen.findByRole('button', { name: 'Add category' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Title'), 'tools');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(
      await within(dialog).findByText('A category with this title already exists'),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true');
  });

  it('edits a category, starting from its current values', async () => {
    const state = categoriesApi([tools]);
    const user = userEvent.setup();
    renderApp({ route: '/categories' });

    await user.click(within(await card('Tools')).getByRole('button', { name: 'Edit Tools' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit category' });
    expect(within(dialog).getByLabelText('Title')).toHaveValue('Tools');
    expect(within(dialog).getByLabelText('Description')).toHaveValue('Hand tools');
    await user.clear(within(dialog).getByLabelText('Title'));
    await user.type(within(dialog).getByLabelText('Title'), 'Hardware');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await card('Hardware')).toBeInTheDocument();
    expect(state.writes).toEqual([
      { method: 'PATCH', id: 'c1', body: { title: 'Hardware', description: 'Hand tools' } },
    ]);
  });

  it('deletes an empty category after a confirmation', async () => {
    const state = categoriesApi([tools, books]);
    const user = userEvent.setup();
    renderApp({ route: '/categories' });

    await user.click(within(await card('Books')).getByRole('button', { name: 'Delete Books' }));
    const dialog = await screen.findByRole('alertdialog', { name: /Delete Books/ });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(state.writes).toEqual([]);

    await user.click(within(await card('Books')).getByRole('button', { name: 'Delete Books' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    await waitFor(() =>
      expect(screen.queryByRole('link', { name: /Books/ })).not.toBeInTheDocument(),
    );
    expect(state.writes).toEqual([{ method: 'DELETE', id: 'c2' }]);
  });

  it('disables Delete for a category that has products, and says why', async () => {
    categoriesApi([tools]);
    renderApp({ route: '/categories' });

    const button = within(await card('Tools')).getByRole('button', { name: 'Delete Tools' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(/3 products/);
  });

  it('shows the server message and refreshes when a delete is blocked after all', async () => {
    const state = categoriesApi([books]);
    state.failNext = {
      status: 409,
      body: {
        code: 'IN_USE',
        message: 'Used by 1 product, including archived ones. Move or delete them first.',
        details: { productCount: 1 },
      },
    };
    const user = userEvent.setup();
    renderApp({ route: '/categories' });

    await user.click(within(await card('Books')).getByRole('button', { name: 'Delete Books' }));
    state.items = [{ ...books, productCount: 1 }];
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/Used by 1 product/);
    expect(await screen.findByText('1 product')).toBeInTheDocument();
    expect(
      within(await card('Books')).getByRole('button', { name: 'Delete Books' }),
    ).toBeDisabled();
  });
});
