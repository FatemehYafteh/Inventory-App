import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import faDashboard from '@/i18n/locales/fa/dashboard.json';
import faProducts from '@/i18n/locales/fa/products.json';
import { renderApp } from '@/test/render';
import { activeUser, server } from '@/test/server';

/** Prices are Iranian Rial: whole numbers with the unit, in both languages, on real pages. */

const admin = { ...activeUser, id: 'a1', name: 'Ana Admin', role: 'admin' };
const TOOLS = { id: 'c'.repeat(24), title: 'Tools' };
const hammer = {
  id: 'p1',
  title: 'Claw Hammer',
  sku: 'HAM-001',
  description: '',
  price: 12_500_000,
  quantity: 40,
  reorderLevel: 2,
  stockStatus: 'in_stock',
  isArchived: false,
  category: TOOLS,
  supplier: null,
  createdAt: '2026-10-14T10:00:00.000Z',
};

function api() {
  server.use(
    http.get('*/api/auth/me', () => HttpResponse.json({ user: admin })),
    http.get('*/api/dashboard', () =>
      HttpResponse.json({
        summary: {
          activeProducts: 3,
          totalUnits: 120,
          inventoryValue: 1_500_000_000,
          lowStockCount: 0,
          outOfStockCount: 0,
        },
        lowStock: [],
        recentMovements: [],
      }),
    ),
    http.get('*/api/products', () =>
      HttpResponse.json({ items: [hammer], total: 1, page: 1, limit: 20 }),
    ),
    http.get('*/api/categories', () =>
      HttpResponse.json({ items: [{ ...TOOLS, description: '', productCount: 1 }] }),
    ),
    http.get('*/api/suppliers', () =>
      HttpResponse.json({ items: [], total: 0, page: 1, limit: 20 }),
    ),
  );
}

describe('Rial on the dashboard', () => {
  it('shows the inventory value as whole Rial in English', async () => {
    api();
    renderApp({ route: '/' });

    const summary = await screen.findByLabelText('Inventory summary');
    const value = within(summary).getByText('Inventory value').parentElement.nextElementSibling;
    expect(value).toHaveTextContent('1,500,000,000 Rial');
    expect(summary).not.toHaveTextContent(/\$|\./);
  });

  it('shows it with Persian digits, Persian separators and the Persian unit in Persian', async () => {
    api();
    await i18n.changeLanguage('fa');
    renderApp({ route: '/' });

    const summary = await screen.findByLabelText(faDashboard.summaryLabel);
    const value = within(summary).getByText(faDashboard.cards.inventoryValue).parentElement
      .nextElementSibling;
    expect(value).toHaveTextContent('۱٬۵۰۰٬۰۰۰٬۰۰۰ ریال');
    expect(value.textContent).not.toMatch(/[0-9,.$]|Rial/);
  });
});

describe('Rial on the Products page', () => {
  it('lists a price as whole Rial in English', async () => {
    api();
    renderApp({ route: '/products' });

    const row = within((await screen.findByText('Claw Hammer')).closest('tr'));
    expect(row.getByText('12,500,000 Rial')).toBeInTheDocument();
  });

  it('lists it in Persian with the Persian unit', async () => {
    api();
    await i18n.changeLanguage('fa');
    renderApp({ route: '/products' });

    const row = within((await screen.findByText('Claw Hammer')).closest('tr'));
    expect(row.getByText('۱۲٬۵۰۰٬۰۰۰ ریال')).toBeInTheDocument();
  });

  it('puts the unit in the price field label, in both languages, with no currency sign', async () => {
    api();
    const user = userEvent.setup();
    renderApp({ route: '/products' });
    await user.click(await screen.findByRole('button', { name: 'Add product' }));
    const field = await screen.findByLabelText('Price (Rial)');
    expect(field).toHaveAttribute('inputmode', 'numeric');
    expect(screen.queryByText('$')).not.toBeInTheDocument();
  });

  it('labels the price field with the Persian unit in Persian', async () => {
    api();
    await i18n.changeLanguage('fa');
    const user = userEvent.setup();
    renderApp({ route: '/products' });
    await user.click(await screen.findByRole('button', { name: 'افزودن کالا' }));

    expect(await screen.findByLabelText(faProducts.form.price)).toBeInTheDocument();
    expect(faProducts.form.price).toBe('قیمت (ریال)');
  });
});
