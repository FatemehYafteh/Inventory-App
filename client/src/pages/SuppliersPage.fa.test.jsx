import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { renderApp } from '@/test/render';
import { openRowMenu } from '@/test/rowMenu';
import { activeUser, server } from '@/test/server';

const admin = { ...activeUser, id: 'a1', name: 'Ana Admin', role: 'admin' };
const acme = {
  id: 'p1',
  name: 'Acme Tools',
  contactPerson: 'Rita Roe',
  phone: '555-0100',
  email: 'rita@acme.test',
  address: '',
  notes: '',
  isActive: true,
  productCount: 2,
  movementCount: 14,
};

function api(items) {
  server.use(
    http.get('*/api/auth/me', () => HttpResponse.json({ user: admin })),
    http.get('*/api/users/pending-count', () => HttpResponse.json({ count: 0 })),
    http.get('*/api/suppliers', () =>
      HttpResponse.json({ items, total: items.length, page: 1, limit: 20 }),
    ),
  );
}

describe('Suppliers page in Persian', () => {
  it('shows headers, row actions and the in-use reason in Persian', async () => {
    await i18n.changeLanguage('fa');
    api([acme]);
    renderApp({ route: '/suppliers' });

    expect(await screen.findByText('Acme Tools')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'تأمین‌کنندگان' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'افزودن تأمین‌کننده' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'جست‌وجوی تأمین‌کنندگان' })).toBeInTheDocument();
    expect(screen.getByText('شخص رابط')).toBeInTheDocument();
    expect(screen.getByText('تعداد کالاها')).toBeInTheDocument();
    expect(screen.getByText('فهرست تأمین‌کنندگان و اطلاعات تماس آن‌ها.')).toBeInTheDocument();
    // The count uses Persian digits and links to that supplier's products.
    expect(screen.getByRole('link', { name: '۲' })).toHaveAttribute(
      'href',
      '/products?supplier=p1',
    );
    expect(screen.getByRole('link', { name: 'rita@acme.test' })).toHaveAttribute('dir', 'ltr');
    expect(screen.getByRole('button', { name: 'ویرایش Acme Tools' })).toBeInTheDocument();
    await openRowMenu(userEvent.setup(), 'عملیات بیشتر برای Acme Tools');
    expect(
      await screen.findByRole('menuitem', { name: 'غیرفعال‌سازی Acme Tools' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'حذف Acme Tools' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByText(/به‌جای حذف، آن را غیرفعال کنید/)).toBeInTheDocument();

    expect(screen.queryByText('Contact person')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Acme Tools' })).not.toBeInTheDocument();
  });

  it('shows the empty state and the add form in Persian', async () => {
    await i18n.changeLanguage('fa');
    api([]);
    const user = userEvent.setup();
    renderApp({ route: '/suppliers' });

    expect(await screen.findByText('هنوز تأمین‌کننده‌ای وجود ندارد.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'افزودن تأمین‌کننده' }));
    expect(await screen.findByLabelText('نشانی')).toBeInTheDocument();
    expect(screen.getByLabelText('یادداشت‌ها')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ذخیره' })).toBeInTheDocument();
    expect(screen.queryByText('No suppliers yet.')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Address')).not.toBeInTheDocument();
  });
});
