import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { activeUser, server } from '@/test/server';

const placeholder = {
  ...activeUser,
  id: '2',
  name: 'Nina Novak',
  email: null,
  emailVerified: false,
  pendingEmail: null,
  telegramConnected: true,
  telegramUsername: 'nina_n',
  role: 'staff',
  status: 'pending',
  profileComplete: false,
};

const GENERIC = {
  message: 'If this email can be used, we have sent a verification link. Check your inbox.',
};

/** `/me` answers with `current.user`, which tests change to move the user on. */
function profileHandlers(user) {
  const current = { user };
  const requests = { complete: [], resend: 0 };
  server.use(
    http.get('*/api/auth/me', () => HttpResponse.json({ user: current.user })),
    http.post('*/api/auth/profile/complete', async ({ request }) => {
      const body = await request.json();
      requests.complete.push(body);
      current.user = { ...current.user, name: body.name, pendingEmail: body.email };
      return HttpResponse.json(GENERIC, { status: 202 });
    }),
    http.post('*/api/auth/profile/resend-verification', () => {
      requests.resend += 1;
      return HttpResponse.json(GENERIC, { status: 202 });
    }),
  );
  return { current, requests };
}

describe('Complete profile', () => {
  it('asks for a name (prefilled) and an email, then says to check the email', async () => {
    const { requests } = profileHandlers(placeholder);
    const user = userEvent.setup();
    renderApp({ route: '/complete-profile' });

    const name = await screen.findByLabelText('Name');
    expect(name).toHaveValue('Nina Novak');
    await user.clear(name);
    await user.type(name, 'Nina N.');
    await user.type(screen.getByLabelText('Email'), 'Nina@Example.com');
    await user.click(screen.getByRole('button', { name: 'Send verification link' }));

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByText('nina@example.com')).toBeInTheDocument();
    expect(
      screen.getByText('Nothing arriving? Use a different email, or contact an admin.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resend email in \d+s/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Use a different email' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    expect(requests.complete).toEqual([{ name: 'Nina N.', email: 'nina@example.com' }]);
  });

  it('shows validation errors on the fields', async () => {
    profileHandlers({ ...placeholder, name: null });
    const user = userEvent.setup();
    renderApp({ route: '/complete-profile' });

    await user.type(await screen.findByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Send verification link' }));

    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
  });

  it('comes back to "Check your email" and can resend or use a different email', async () => {
    const { requests } = profileHandlers({ ...placeholder, pendingEmail: 'old@example.com' });
    const user = userEvent.setup();
    renderApp({ route: '/complete-profile' });

    expect(await screen.findByText('old@example.com')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Resend email' }));
    expect(await screen.findByRole('button', { name: /Resend email in \d+s/ })).toBeDisabled();
    expect(requests.resend).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Use a different email' }));
    await user.click(await screen.findByRole('button', { name: 'Back to old@example.com' }));
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Use a different email' }));
    const email = await screen.findByLabelText('Email');
    expect(email).toHaveValue('');
    await user.type(email, 'new@example.com');
    await user.click(screen.getByRole('button', { name: 'Send verification link' }));

    expect(await screen.findByText('new@example.com')).toBeInTheDocument();
    expect(requests.complete).toEqual([{ name: 'Nina Novak', email: 'new@example.com' }]);
  });

  it('returns to Login without an error once an Account link removed this user', async () => {
    profileHandlers({ ...placeholder, pendingEmail: 'olga@example.com' });
    renderApp({ route: '/complete-profile' });
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();

    // The owner confirmed the link: this Placeholder user and its sessions are gone.
    server.use(
      http.get('*/api/auth/me', () =>
        HttpResponse.json(
          { message: 'Please log in to continue.', code: 'NOT_AUTHENTICATED' },
          { status: 401 },
        ),
      ),
    );

    expect(
      await screen.findByRole('button', { name: 'Log in' }, { timeout: 7000 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  }, 10_000);

  it('moves on to Awaiting approval once the email is verified, even on another device', async () => {
    const { current } = profileHandlers({ ...placeholder, pendingEmail: 'nina@example.com' });
    renderApp({ route: '/complete-profile' });
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();

    // The link is opened elsewhere; the next poll of /me sees the verified email.
    current.user = {
      ...placeholder,
      email: 'nina@example.com',
      emailVerified: true,
      profileComplete: true,
    };

    expect(
      await screen.findByRole('heading', { name: 'Awaiting approval' }, { timeout: 7000 }),
    ).toBeInTheDocument();
  }, 10_000);
});
