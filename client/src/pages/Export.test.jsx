import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '@/test/render';
import { activeUser, server } from '@/test/server';

const admin = { ...activeUser, id: 'a1', name: 'Ana Admin', role: 'admin' };
const staff = { ...activeUser, id: 's1', name: 'Sam Staff', role: 'staff' };

const SAM_ID = '2'.repeat(24);

const saved = [];
let clickSpy;

beforeEach(() => {
  saved.length = 0;
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
    saved.push({ filename: this.download, href: this.href });
  });
});

afterEach(() => {
  clickSpy.mockRestore();
});

function csvResponse(name) {
  return new HttpResponse('Title,SKU\r\n', {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
    },
  });
}

function api({ me = admin, exportResponse } = {}) {
  const state = { exports: [] };
  server.use(
    http.get('*/api/auth/me', () => HttpResponse.json({ user: me })),
    http.get('*/api/movements/performers', () => HttpResponse.json({ items: [] })),
    http.get('*/api/movements/export', ({ request }) => {
      state.exports.push(Object.fromEntries(new URL(request.url).searchParams));
      return exportResponse?.() ?? csvResponse('movements-2026-10-21.csv');
    }),
    http.get('*/api/movements', () =>
      HttpResponse.json({ items: [], total: 0, page: 1, limit: 20 }),
    ),
    http.get('*/api/products/export', ({ request }) => {
      state.exports.push(Object.fromEntries(new URL(request.url).searchParams));
      return exportResponse?.() ?? csvResponse('products-2026-10-21.csv');
    }),
    http.get('*/api/products', () =>
      HttpResponse.json({ items: [], total: 0, page: 1, limit: 20 }),
    ),
    http.get('*/api/categories', () => HttpResponse.json({ items: [] })),
    http.get('*/api/suppliers', () =>
      HttpResponse.json({ items: [], total: 0, page: 1, limit: 100 }),
    ),
  );
  return state;
}

describe('Movements CSV export', () => {
  it('downloads the file for the current filters, without paging', async () => {
    const user = userEvent.setup();
    const state = api();
    const from = new Date(2026, 9, 14).toISOString();
    const to = new Date(2026, 9, 16).toISOString();
    renderApp({
      route: `/movements?user=${SAM_ID}&type=ship&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&page=2&limit=50`,
    });

    await user.click(await screen.findByRole('button', { name: 'Export CSV' }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].filename).toBe('movements-2026-10-21.csv');
    expect(state.exports).toEqual([{ user: SAM_ID, type: 'ship', from, to }]);
  });

  it('is open to staff', async () => {
    const user = userEvent.setup();
    api({ me: staff });
    renderApp({ route: '/movements' });

    await user.click(await screen.findByRole('button', { name: 'Export CSV' }));

    await waitFor(() => expect(saved).toHaveLength(1));
  });

  it('shows the error and saves nothing when the export fails', async () => {
    const user = userEvent.setup();
    api({
      exportResponse: () =>
        HttpResponse.json(
          { message: 'Request is invalid', code: 'VALIDATION_ERROR' },
          { status: 400 },
        ),
    });
    renderApp({ route: '/movements' });

    await user.click(await screen.findByRole('button', { name: 'Export CSV' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Request is invalid');
    expect(saved).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled();
  });
});

describe('Products CSV export', () => {
  it('downloads the file for the current search, filters and sort', async () => {
    const user = userEvent.setup();
    const state = api();
    renderApp({ route: '/products?search=ham&status=low_stock&sortBy=price&order=desc&page=3' });

    await user.click(await screen.findByRole('button', { name: 'Export CSV' }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].filename).toBe('products-2026-10-21.csv');
    expect(state.exports).toEqual([
      { search: 'ham', status: 'low_stock', sortBy: 'price', order: 'desc' },
    ]);
  });

  it('includes archived products only when an admin shows them', async () => {
    const user = userEvent.setup();
    const state = api();
    renderApp({ route: '/products?archived=true' });

    await user.click(await screen.findByRole('button', { name: 'Export CSV' }));

    await waitFor(() => expect(state.exports).toHaveLength(1));
    expect(state.exports[0].archived).toBe('true');
  });

  it('is open to staff and never asks for archived products', async () => {
    const user = userEvent.setup();
    const state = api({ me: staff });
    renderApp({ route: '/products?archived=true' });

    await user.click(await screen.findByRole('button', { name: 'Export CSV' }));

    await waitFor(() => expect(state.exports).toHaveLength(1));
    expect(state.exports[0].archived).toBeUndefined();
  });
});
