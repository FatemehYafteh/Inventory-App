import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

describe('VerifyEmailPage', () => {
  it('verifies the token from the link once and offers to log in', async () => {
    const verify = vi.fn(async ({ request }) => {
      expect(await request.json()).toEqual({ token: 'abc123' });
      return HttpResponse.json({ message: 'Your email is verified. You can now log in.' });
    });
    server.use(http.post('*/api/auth/verify-email', verify));

    renderApp({ route: '/verify-email?token=abc123' });

    expect(await screen.findByRole('heading', { name: 'Email verified' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Your email is verified');
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it('offers a new link when the token is invalid or expired', async () => {
    server.use(
      http.post('*/api/auth/verify-email', () =>
        HttpResponse.json(
          { message: 'This link is invalid or has expired.', code: 'INVALID_TOKEN' },
          { status: 400 },
        ),
      ),
    );
    renderApp({ route: '/verify-email?token=old' });

    expect(await screen.findByRole('heading', { name: 'Link not valid' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send verification link' })).toBeInTheDocument();
  });

  it('sends a new link and then waits before allowing another', async () => {
    let sent;
    server.use(
      http.post('*/api/auth/resend-verification', async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ message: 'ok' }, { status: 202 });
      }),
    );
    const user = userEvent.setup();
    renderApp({ route: '/verify-email' });

    await user.type(await screen.findByLabelText('Email'), ' Nora@Example.com');
    await user.click(screen.getByRole('button', { name: 'Send verification link' }));

    expect(await screen.findByText(/a new link is on its way/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send again in \d+s/ })).toBeDisabled();
    expect(sent).toEqual({ email: 'nora@example.com' });
  });

  it('validates the email before sending', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/verify-email' });
    await user.click(await screen.findByRole('button', { name: 'Send verification link' }));
    expect(await screen.findByText('Email is required')).toBeInTheDocument();
  });
});
