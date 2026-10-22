import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { renderApp } from '@/test/render';
import { activeUser, server } from '@/test/server';

describe('Persian layout, table and common texts', () => {
  it('shows the navigation and the dashboard in Persian', async () => {
    await i18n.changeLanguage('fa');
    server.use(
      http.get('*/api/auth/me', () =>
        HttpResponse.json({ user: { ...activeUser, role: 'admin' } }),
      ),
      http.get('*/api/users/pending-count', () => HttpResponse.json({ count: 0 })),
    );
    renderApp({ route: '/' });

    expect(await screen.findByRole('button', { name: 'خروج' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'کاربران' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'محصولات' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'داشبورد' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'پرش به محتوای اصلی' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
  });

  it('shows the table controls in Persian', async () => {
    await i18n.changeLanguage('fa');
    server.use(
      http.get('*/api/auth/me', () =>
        HttpResponse.json({ user: { ...activeUser, role: 'admin' } }),
      ),
      http.get('*/api/users/pending-count', () => HttpResponse.json({ count: 0 })),
      http.get('*/api/users', () => HttpResponse.json({ items: [], total: 0, page: 1, limit: 20 })),
    );
    renderApp({ route: '/users' });

    expect(await screen.findByText('تعداد ردیف در صفحه')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'قبلی' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'بعدی' })).toBeInTheDocument();
    expect(screen.queryByText('Rows per page')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
  });

  it('shows the not-found page in Persian', async () => {
    await i18n.changeLanguage('fa');
    renderApp({ route: '/nowhere' });

    expect(await screen.findByRole('heading', { name: 'صفحه پیدا نشد' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'رفتن به صفحه اصلی' })).toBeInTheDocument();
    expect(screen.queryByText('Page not found')).not.toBeInTheDocument();
  });
});
