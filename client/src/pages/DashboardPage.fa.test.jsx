import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { renderApp } from '@/test/render';
import { activeUser, server } from '@/test/server';

const admin = { ...activeUser, id: 'a1', name: 'Ana Admin', role: 'admin' };

const data = {
  summary: {
    activeProducts: 12,
    totalUnits: 345,
    inventoryValue: 1500,
    lowStockCount: 1,
    outOfStockCount: 0,
  },
  lowStock: [
    {
      id: 'p1',
      title: 'Claw Hammer',
      sku: 'HAM-001',
      quantity: 2,
      reorderLevel: 10,
      stockStatus: 'low_stock',
      supplier: null,
    },
  ],
  recentMovements: [
    {
      id: 'm1',
      product: { id: 'p1', title: 'Claw Hammer', sku: 'HAM-001' },
      type: 'ship',
      quantityChange: -3,
      quantityBefore: 5,
      quantityAfter: 2,
      supplier: null,
      note: '',
      performedBy: { id: 'u1', name: 'Ana Admin', role: 'admin' },
      createdAt: '2026-10-14T10:30:00.000Z',
    },
  ],
};

describe('Dashboard texts in Persian', () => {
  it('shows the cards, the restocking list and the recent movements in Persian', async () => {
    server.use(
      http.get('*/api/auth/me', () => HttpResponse.json({ user: admin })),
      http.get('*/api/users/pending-count', () => HttpResponse.json({ count: 2 })),
      http.get('*/api/dashboard', () => HttpResponse.json(data)),
    );
    await i18n.changeLanguage('fa');
    renderApp({ route: '/' });

    expect(await screen.findByRole('heading', { level: 1, name: 'داشبورد' })).toBeInTheDocument();
    const summary = await screen.findByLabelText('خلاصهٔ موجودی');
    const card = (label) => within(summary).getByText(label).parentElement;
    expect(within(card('محصولات فعال')).getByText('۱۲')).toBeInTheDocument();
    expect(within(card('مجموع تعداد')).getByText('۳۴۵')).toBeInTheDocument();
    expect(within(card('در انتظار تأیید')).getByText('۲')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'نیازمند تأمین مجدد' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'دریافت Claw Hammer' })).toBeInTheDocument();
    expect(screen.getByText('۲ عدد موجود، حد سفارش ۱۰')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'حرکت‌های اخیر' })).toBeInTheDocument();
    expect(screen.getByText('−۳')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'مشاهدهٔ همهٔ حرکت‌ها' })).toBeInTheDocument();
    expect(screen.queryByText('Needs restocking')).not.toBeInTheDocument();
  });
});
