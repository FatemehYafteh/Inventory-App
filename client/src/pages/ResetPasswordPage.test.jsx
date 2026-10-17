import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

const NEW_PASSWORD = 'amber-meadow-compass';

async function fillAndSubmit(user, password, confirmPassword = password) {
  await user.type(await screen.findByLabelText('New password'), password);
  await user.type(screen.getByLabelText('Confirm new password'), confirmPassword);
  await user.click(screen.getByRole('button', { name: 'Save new password' }));
}

const invalidToken = () =>
  HttpResponse.json(
    { message: 'This link is invalid or has expired.', code: 'INVALID_TOKEN' },
    { status: 400 },
  );

describe('ResetPasswordPage', () => {
  it('sends the token with the new password and opens login with a notice', async () => {
    let sent;
    server.use(
      http.post('*/api/auth/reset-password', async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ message: 'Your password has been changed.' });
      }),
    );
    const user = userEvent.setup();
    renderApp({ route: '/reset-password?token=abc123' });

    await fillAndSubmit(user, NEW_PASSWORD);

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Password changed. Log in with your new password.',
    );
    expect(sent).toEqual({
      token: 'abc123',
      password: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });
  });

  it('validates the password with the shared schema before sending', async () => {
    const handler = vi.fn(() => HttpResponse.json({ message: 'ok' }));
    server.use(http.post('*/api/auth/reset-password', handler));
    const user = userEvent.setup();
    renderApp({ route: '/reset-password?token=abc123' });

    await fillAndSubmit(user, 'short', 'different');

    expect(await screen.findByText('Password must be at least 10 characters')).toBeInTheDocument();
    expect(handler).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('New password'));
    await user.clear(screen.getByLabelText('Confirm new password'));
    await fillAndSubmit(user, NEW_PASSWORD, 'something-else-entirely');
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(handler).not.toHaveBeenCalled();
  });

  it('offers a new link when the server says the link is invalid', async () => {
    server.use(http.post('*/api/auth/reset-password', invalidToken));
    const user = userEvent.setup();
    renderApp({ route: '/reset-password?token=old' });

    await fillAndSubmit(user, NEW_PASSWORD);

    expect(await screen.findByRole('heading', { name: 'Link not valid' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('shows the invalid-link screen when the link has no token', async () => {
    renderApp({ route: '/reset-password' });
    expect(await screen.findByRole('heading', { name: 'Link not valid' })).toBeInTheDocument();
  });

  it('shows a password error from the server on its field', async () => {
    server.use(
      http.post('*/api/auth/reset-password', () =>
        HttpResponse.json(
          {
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            errors: { password: 'This password is too common. Choose another one.' },
          },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderApp({ route: '/reset-password?token=abc123' });

    await fillAndSubmit(user, NEW_PASSWORD);

    expect(
      await screen.findByText('This password is too common. Choose another one.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toHaveAttribute('aria-invalid', 'true');
  });
});
