import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { renderApp } from '@/test/render';
import { activeUser, server } from '@/test/server';

const admin = { ...activeUser, id: 'a1', name: 'Ana Admin', role: 'admin' };

const movement = {
  id: 'm1',
  product: { id: 'b'.repeat(24), title: 'Claw Hammer', sku: 'HAM-001' },
  type: 'receive',
  quantityChange: 40,
  quantityBefore: 0,
  quantityAfter: 40,
  supplier: null,
  note: '',
  performedBy: { id: '1'.repeat(24), name: 'Ana Admin', role: 'admin' },
  createdAt: '2026-10-14T10:30:00.000Z',
};

function movementsApi(items, queries = []) {
  server.use(
    http.get('*/api/auth/me', () => HttpResponse.json({ user: admin })),
    http.get('*/api/movements/performers', () => HttpResponse.json({ items: [] })),
    http.get('*/api/movements', ({ request }) => {
      queries.push(Object.fromEntries(new URL(request.url).searchParams));
      return HttpResponse.json({ items, total: items.length, page: 1, limit: 20 });
    }),
    http.get('*/api/suppliers', () =>
      HttpResponse.json({ items: [], total: 0, page: 1, limit: 100 }),
    ),
    http.get('*/api/products', () =>
      HttpResponse.json({ items: [], total: 0, page: 1, limit: 20 }),
    ),
  );
}

describe('Movements page texts in Persian', () => {
  it('shows the table, filters and role badge in Persian with Persian digits', async () => {
    movementsApi([movement]);
    await i18n.changeLanguage('fa');
    renderApp({ route: '/movements' });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'حرکت‌های موجودی' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'محصول' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'نوع' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'تأمین‌کننده' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'انجام‌دهنده' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تاریخ‌ها' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'پاک کردن فیلترها' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'انجام‌دهنده' })).toBeInTheDocument();

    const row = within((await screen.findAllByRole('row'))[1]);
    expect(row.getByText('دریافت')).toBeInTheDocument();
    expect(row.getByText('+۴۰')).toBeInTheDocument();
    expect(row.getByText('Ana Admin')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Stock movements' })).not.toBeInTheDocument();
  });

  it('shows the empty state in Persian', async () => {
    movementsApi([]);
    await i18n.changeLanguage('fa');
    renderApp({ route: '/movements' });

    expect(await screen.findByText('هنوز حرکتی در موجودی ثبت نشده است.')).toBeInTheDocument();
  });

  it('opens a Jalali calendar and still sends ordinary ISO instants', async () => {
    const queries = [];
    movementsApi([movement], queries);
    await i18n.changeLanguage('fa');
    const user = userEvent.setup();
    const start = new Date(2026, 9, 14).toISOString();
    renderApp({ route: `/movements?from=${encodeURIComponent(start)}` });
    await screen.findByText('Claw Hammer');

    await user.click(screen.getByRole('button', { name: 'تاریخ‌ها' }));
    // 22 Mehr 1405 is 14 October 2026; the calendar shows the Jalali month.
    expect(await screen.findByRole('status', { name: '' })).toHaveTextContent('مهر ۱۴۰۵');

    await user.click(screen.getByRole('button', { name: 'پاک کردن تاریخ‌ها' }));
    await waitFor(() => expect(queries[queries.length - 1].from).toBeUndefined());
  });
});
