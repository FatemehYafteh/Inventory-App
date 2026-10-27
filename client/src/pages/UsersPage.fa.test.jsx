import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { renderApp } from '@/test/render';
import { activeUser, server } from '@/test/server';

const admin = { ...activeUser, id: 'a1', name: 'Ana Admin', role: 'admin' };
const pat = {
  id: 'u1',
  name: 'Pat Pending',
  email: 'pat@example.com',
  emailVerified: true,
  hasPassword: true,
  hasTelegram: false,
  telegramUsername: null,
  role: 'staff',
  status: 'pending',
  statusReason: null,
  profileComplete: false,
  createdAt: '2026-03-01T10:00:00.000Z',
  lastLoginAt: null,
};

function api(items) {
  server.use(
    http.get('*/api/auth/me', () => HttpResponse.json({ user: admin })),
    http.get('*/api/users/pending-count', () => HttpResponse.json({ count: 0 })),
    http.get('*/api/users/:id', () =>
      HttpResponse.json({
        user: pat,
        history: [
          {
            id: 'h1',
            from: 'pending',
            to: 'rejected',
            changedByName: 'Ana Admin',
            at: '2026-03-02T10:00:00.000Z',
            reason: null,
          },
        ],
      }),
    ),
    http.get('*/api/users', () =>
      HttpResponse.json({ items, total: items.length, page: 1, limit: 20 }),
    ),
  );
}

describe('Users page in Persian', () => {
  it('shows the tabs, table headers, row actions and filters in Persian', async () => {
    await i18n.changeLanguage('fa');
    api([pat]);
    renderApp({ route: '/users' });

    expect(await screen.findByText('Pat Pending')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'کاربران' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'در انتظار' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'ردشده' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'جستجوی کاربران' })).toBeInTheDocument();
    expect(screen.getByText('پروفایل ناقص')).toBeInTheDocument();
    expect(screen.getByText('روش‌های ورود')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تأیید' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'رد' })).toBeInTheDocument();
    expect(
      screen.getByText('برای تأیید، ابتدا باید پروفایل خود را کامل کنند.'),
    ).toBeInTheDocument();

    expect(screen.queryByRole('tab', { name: 'Pending' })).not.toBeInTheDocument();
    expect(screen.queryByText('Incomplete profile')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('shows the empty state in Persian', async () => {
    await i18n.changeLanguage('fa');
    api([]);
    renderApp({ route: '/users' });

    expect(await screen.findByText('هیچ‌کس منتظر تأیید نیست.')).toBeInTheDocument();
    expect(screen.queryByText('No one is waiting for approval.')).not.toBeInTheDocument();
  });

  it('shows the details drawer and its status history in Persian', async () => {
    await i18n.changeLanguage('fa');
    api([pat]);
    renderApp({ route: '/users?user=u1' });

    expect(await screen.findByText('در انتظار به ردشده')).toBeInTheDocument();
    expect(screen.getByText('پروفایل و تاریخچه وضعیت')).toBeInTheDocument();
    expect(screen.getByText('مشاهده حرکت‌ها')).toBeInTheDocument();
    expect(screen.queryByText('Pending to Rejected')).not.toBeInTheDocument();
    expect(screen.queryByText('View movements')).not.toBeInTheDocument();
  });
});
