import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { renderApp } from '@/test/render';
import { activeUser, server } from '@/test/server';

const admin = { ...activeUser, id: 'a1', name: 'Ana Admin', role: 'admin' };
const TOOLS_ID = 'c'.repeat(24);
const ACME_ID = 'a'.repeat(24);

const hammer = {
  id: 'p1',
  title: 'Claw Hammer',
  sku: 'HAM-001',
  description: '',
  price: 12.5,
  quantity: 40,
  reorderLevel: 2,
  stockStatus: 'in_stock',
  isArchived: false,
  category: { id: TOOLS_ID, title: 'Tools' },
  supplier: { id: ACME_ID, name: 'Acme Tools' },
  createdAt: '2026-10-14T10:00:00.000Z',
};

function productsApi(items) {
  server.use(
    http.get('*/api/auth/me', () => HttpResponse.json({ user: admin })),
    http.get('*/api/users/pending-count', () => HttpResponse.json({ count: 0 })),
    http.get('*/api/categories', () =>
      HttpResponse.json({ items: [{ id: TOOLS_ID, title: 'Tools' }] }),
    ),
    http.get('*/api/suppliers', () =>
      HttpResponse.json({
        items: [{ id: ACME_ID, name: 'Acme Tools', isActive: true }],
        total: 1,
        page: 1,
        limit: 100,
      }),
    ),
    http.get('*/api/products/:id/movements', () =>
      HttpResponse.json({
        items: [
          {
            id: 'm1',
            type: 'ship',
            quantityChange: -2,
            quantityBefore: 5,
            quantityAfter: 3,
            supplier: null,
            note: '',
            performedBy: { id: 's1', name: 'Sam Staff' },
            createdAt: '2026-10-14T10:30:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
      }),
    ),
    http.get('*/api/products', () =>
      HttpResponse.json({ items, total: items.length, page: 1, limit: 20 }),
    ),
  );
}

describe('Products page texts in Persian', () => {
  it('shows the list, filters and row actions in Persian', async () => {
    productsApi([hammer]);
    await i18n.changeLanguage('fa');
    renderApp({ route: '/products' });

    expect(await screen.findByRole('heading', { level: 1, name: 'محصولات' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'افزودن محصول' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'جستجوی محصولات' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'وضعیت موجودی' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'پاک کردن فیلترها' })).toBeInTheDocument();
    expect(screen.getByLabelText('نمایش بایگانی‌شده‌ها')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'اصلاح موجودی Claw Hammer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'کاهش تعداد Claw Hammer' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /قیمت/ })).toBeInTheDocument();

    expect(screen.queryByRole('heading', { name: 'Products' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Product' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adjust stock of Claw Hammer' })).toBeNull();
  });

  it('shows the empty state in Persian', async () => {
    productsApi([]);
    await i18n.changeLanguage('fa');
    renderApp({ route: '/products' });

    expect(await screen.findByText('هنوز محصولی وجود ندارد.')).toBeInTheDocument();
    expect(screen.queryByText('No products yet.')).not.toBeInTheDocument();
  });

  it('opens the form, the adjust dialog, the history and the archive confirmation in Persian', async () => {
    productsApi([hammer]);
    await i18n.changeLanguage('fa');
    const user = userEvent.setup();
    renderApp({ route: '/products' });

    await user.click(await screen.findByRole('button', { name: 'افزودن محصول' }));
    const form = within(await screen.findByRole('dialog', { name: 'افزودن محصول' }));
    expect(form.getByLabelText('عنوان')).toBeInTheDocument();
    expect(form.getByLabelText('حد سفارش')).toBeInTheDocument();
    expect(form.getByLabelText('تعداد اولیه')).toBeInTheDocument();
    expect(form.getByRole('button', { name: 'ذخیره' })).toBeInTheDocument();
    expect(form.queryByText('Reorder level')).not.toBeInTheDocument();
    await user.click(form.getByRole('button', { name: 'لغو' }));

    await user.click(screen.getByRole('button', { name: 'اصلاح موجودی Claw Hammer' }));
    const adjust = within(await screen.findByRole('dialog', { name: 'اصلاح موجودی' }));
    expect(adjust.getByRole('tab', { name: 'دریافت' })).toBeInTheDocument();
    expect(adjust.getByLabelText('تعداد برای افزودن')).toBeInTheDocument();
    expect(adjust.getByText(/تعداد فعلی/)).toHaveTextContent('تعداد فعلی: ۴۰');
    await user.type(adjust.getByLabelText('تعداد برای افزودن'), '2');
    expect(adjust.getByText(/تعداد فعلی/)).toHaveTextContent('تعداد جدید: ۴۲');
    await user.click(adjust.getByRole('button', { name: 'لغو' }));

    await user.click(screen.getByRole('button', { name: 'تاریخچه موجودی Claw Hammer' }));
    const history = within(await screen.findByRole('dialog', { name: 'تاریخچه موجودی' }));
    expect(await history.findByText('ارسال')).toBeInTheDocument();
    expect(history.getByText('−۲')).toBeInTheDocument();
    expect(history.getByRole('columnheader', { name: /انجام‌دهنده/ })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'بایگانی Claw Hammer' }));
    const archive = within(
      await screen.findByRole('alertdialog', { name: 'Claw Hammer بایگانی شود؟' }),
    );
    expect(archive.getByRole('button', { name: 'بایگانی' })).toBeInTheDocument();
    expect(archive.getByRole('button', { name: 'لغو' })).toBeInTheDocument();
  });
});
