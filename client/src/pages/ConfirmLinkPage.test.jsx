import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

function confirmHandler(respond) {
  const bodies = [];
  server.use(
    http.post('*/api/auth/link-telegram/confirm', async ({ request }) => {
      bodies.push(await request.json());
      return respond();
    }),
  );
  return bodies;
}

async function submitPassword(user, password = 'correct-horse-battery') {
  await user.type(await screen.findByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Confirm link' }));
}

describe('Confirm link', () => {
  it('confirms the Account link with the account password and offers to log in', async () => {
    const bodies = confirmHandler(() =>
      HttpResponse.json({
        message: 'Telegram is now connected to your account. Log in with Telegram or your email.',
      }),
    );
    const user = userEvent.setup();
    renderApp({ route: '/confirm-link?token=link-token' });

    await submitPassword(user);

    expect(
      await screen.findByText(
        'Telegram is now connected to your account. Log in with Telegram or your email.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
    expect(bodies).toEqual([{ token: 'link-token', password: 'correct-horse-battery' }]);
  });

  it('shows a wrong password on the field and keeps the form', async () => {
    confirmHandler(() =>
      HttpResponse.json(
        {
          message: 'Incorrect password.',
          code: 'INVALID_PASSWORD',
          errors: { password: 'Incorrect password.' },
        },
        { status: 401 },
      ),
    );
    const user = userEvent.setup();
    renderApp({ route: '/confirm-link?token=link-token' });

    await submitPassword(user, 'wrong-password');

    expect(await screen.findByText('Incorrect password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
  });

  it('says the link is not valid when it is expired, used or no longer applies', async () => {
    confirmHandler(() =>
      HttpResponse.json(
        { message: 'This link is invalid or has expired.', code: 'INVALID_TOKEN' },
        { status: 400 },
      ),
    );
    const user = userEvent.setup();
    renderApp({ route: '/confirm-link?token=link-token' });

    await submitPassword(user);

    expect(await screen.findByRole('heading', { name: 'Link not valid' })).toBeInTheDocument();
  });

  it('says the link is not valid when it has no token', async () => {
    renderApp({ route: '/confirm-link' });
    expect(await screen.findByRole('heading', { name: 'Link not valid' })).toBeInTheDocument();
  });
});
