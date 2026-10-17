import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

const GENERIC = {
  message:
    'If an account can reset its password with this email, we have sent a link. Check your inbox.',
};

function acceptForgot(onRequest = () => {}) {
  const handler = vi.fn(async ({ request }) => {
    onRequest(await request.json());
    return HttpResponse.json(GENERIC, { status: 202 });
  });
  server.use(http.post('*/api/auth/forgot-password', handler));
  return handler;
}

describe('ForgotPasswordPage', () => {
  it('opens from the login page with the typed email filled in', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/login' });

    await user.type(await screen.findByLabelText('Email'), ' ana@example.com ');
    await user.click(screen.getByRole('link', { name: 'Forgot password?' }));

    expect(await screen.findByRole('heading', { name: 'Forgot password' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('ana@example.com');
  });

  it('sends the trimmed, lowercased email and shows the check-your-email screen', async () => {
    let sent;
    acceptForgot((body) => {
      sent = body;
    });
    const user = userEvent.setup();
    renderApp({ route: '/forgot-password' });

    await user.type(await screen.findByLabelText('Email'), ' Ana@Example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();
    expect(screen.getByText(/expires in 30 minutes/)).toBeInTheDocument();
    expect(sent).toEqual({ email: 'ana@example.com' });
  });

  it('only allows a resend after the 60 second countdown', async () => {
    const handler = acceptForgot();
    const user = userEvent.setup();
    renderApp({ route: '/forgot-password' });

    await user.type(await screen.findByLabelText('Email'), 'ana@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    const resend = await screen.findByRole('button', { name: /Resend email in \d+s/ });
    expect(resend).toBeDisabled();
    expect(resend).toHaveTextContent(/in (60|59)s/);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('validates the email before sending', async () => {
    const handler = acceptForgot();
    const user = userEvent.setup();
    renderApp({ route: '/forgot-password' });

    await user.type(await screen.findByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(handler).not.toHaveBeenCalled();
  });

  it('shows the rate limit message', async () => {
    server.use(
      http.post('*/api/auth/forgot-password', () =>
        HttpResponse.json(
          { message: 'Too many attempts. Please try again later.', code: 'RATE_LIMITED' },
          { status: 429 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderApp({ route: '/forgot-password' });

    await user.type(await screen.findByLabelText('Email'), 'ana@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Too many attempts/);
  });
});
