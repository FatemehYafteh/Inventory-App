import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { renderApp } from '@/test/render';
import { activeUser, server } from '@/test/server';

beforeEach(async () => {
  await i18n.changeLanguage('fa');
});

describe('signed-out auth pages in Persian', () => {
  it('shows the login page in Persian', async () => {
    renderApp({ route: '/login' });

    expect(await screen.findByRole('heading', { name: 'ورود' })).toBeInTheDocument();
    expect(screen.getByLabelText('ایمیل')).toBeInTheDocument();
    expect(screen.getByLabelText('رمز عبور')).toBeInTheDocument();
    expect(screen.getByText('رمز عبور را فراموش کرده‌اید؟')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'تلگرام' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Log in' })).not.toBeInTheDocument();
    expect(screen.queryByText('Forgot password?')).not.toBeInTheDocument();
  });

  it('shows the Telegram sign-in start in Persian', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/login' });
    await user.click(await screen.findByRole('tab', { name: 'تلگرام' }));

    expect(await screen.findByRole('button', { name: 'ادامه با تلگرام' })).toBeInTheDocument();
    expect(screen.queryByText('Continue with Telegram')).not.toBeInTheDocument();
  });

  it('shows the register page in Persian', async () => {
    renderApp({ route: '/register' });

    expect(await screen.findByRole('heading', { name: 'ایجاد حساب کاربری' })).toBeInTheDocument();
    expect(screen.getByLabelText('تکرار رمز عبور')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ایجاد حساب' })).toBeInTheDocument();
    expect(screen.queryByText('Create an account')).not.toBeInTheDocument();
  });

  it('shows the forgot password page in Persian', async () => {
    renderApp({ route: '/forgot-password' });

    expect(await screen.findByRole('heading', { name: 'فراموشی رمز عبور' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ارسال پیوند بازنشانی' })).toBeInTheDocument();
    expect(screen.queryByText('Send reset link')).not.toBeInTheDocument();
  });

  it('shows the invalid reset link page in Persian', async () => {
    renderApp({ route: '/reset-password' });

    expect(await screen.findByRole('heading', { name: 'پیوند نامعتبر است' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'درخواست پیوند جدید' })).toBeInTheDocument();
    expect(screen.queryByText('Link not valid')).not.toBeInTheDocument();
  });

  it('shows the verify email page in Persian', async () => {
    renderApp({ route: '/verify-email' });

    expect(await screen.findByRole('heading', { name: 'تأیید ایمیل' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ارسال پیوند تأیید' })).toBeInTheDocument();
    expect(screen.queryByText('Verify your email')).not.toBeInTheDocument();
  });
});

describe('signed-in auth pages in Persian', () => {
  it('shows the awaiting approval page in Persian', async () => {
    server.use(
      http.get('*/api/auth/me', () =>
        HttpResponse.json({ user: { ...activeUser, name: 'Pat', status: 'pending' } }),
      ),
    );
    renderApp({ route: '/awaiting-approval' });

    expect(await screen.findByText('در انتظار تأیید')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'خروج' })).toBeInTheDocument();
    expect(screen.queryByText('Awaiting approval')).not.toBeInTheDocument();
  });

  it('shows the profile page in Persian', async () => {
    server.use(
      http.get('*/api/auth/me', () =>
        HttpResponse.json({ user: { ...activeUser, telegramConnected: false } }),
      ),
    );
    renderApp({ route: '/profile' });

    expect(await screen.findByRole('heading', { name: 'پروفایل' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'روش‌های ورود' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ذخیره نام' })).toBeInTheDocument();
    expect(screen.getByText('متصل نیست')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Profile' })).not.toBeInTheDocument();
    expect(screen.queryByText('Not connected')).not.toBeInTheDocument();
  });
});
