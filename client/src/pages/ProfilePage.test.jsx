import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { activeUser, server } from '@/test/server';

const pendingUser = {
  ...activeUser,
  id: '3',
  name: 'Pat Pending',
  email: 'pat@example.com',
  role: 'staff',
  status: 'pending',
  telegramConnected: true,
  telegramUsername: 'pat_tg',
};

/** Serves `user` from /me and records the PATCH and password reset bodies. */
function profileHandlers(user) {
  const current = { user };
  const requests = { patch: [], reset: [] };
  server.use(
    http.get('*/api/auth/me', () => HttpResponse.json({ user: current.user })),
    http.patch('*/api/auth/profile', async ({ request }) => {
      const body = await request.json();
      requests.patch.push(body);
      current.user = { ...current.user, name: body.name.trim() };
      return HttpResponse.json({ user: current.user });
    }),
    http.post('*/api/auth/forgot-password', async ({ request }) => {
      requests.reset.push(await request.json());
      return HttpResponse.json({ message: 'sent' }, { status: 202 });
    }),
  );
  return requests;
}

function signInMethods() {
  return within(screen.getByRole('region', { name: 'Sign-in methods' }));
}

describe('Profile page', () => {
  it('shows an active user their sign-in methods inside the app layout', async () => {
    profileHandlers(activeUser);
    renderApp({ route: '/profile' });

    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();

    const methods = signInMethods();
    expect(methods.getByText('ana@example.com')).toBeInTheDocument();
    expect(methods.getByText('Verified')).toBeInTheDocument();
    expect(methods.getByText('Not connected')).toBeInTheDocument();
    expect(methods.getByRole('button', { name: 'Connect Telegram' })).toBeInTheDocument();
  });

  it('shows a pending user the page in a minimal layout, reached from Awaiting approval', async () => {
    profileHandlers(pendingUser);
    const user = userEvent.setup();
    renderApp({ route: '/awaiting-approval' });

    await user.click(await screen.findByRole('link', { name: 'Edit profile / connect Telegram' }));

    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Awaiting approval' })).toBeInTheDocument();
    expect(signInMethods().getByText('Connected as @pat_tg')).toBeInTheDocument();
    expect(signInMethods().queryByRole('button', { name: 'Connect Telegram' })).toBeNull();
  });

  it('says Telegram is connected when the account has no Telegram username', async () => {
    profileHandlers({ ...activeUser, telegramConnected: true, telegramUsername: null });
    renderApp({ route: '/profile' });

    await screen.findByRole('heading', { name: 'Profile' });
    expect(signInMethods().getByText('Connected')).toBeInTheDocument();
  });

  it('saves a new name', async () => {
    const requests = profileHandlers(activeUser);
    const user = userEvent.setup();
    renderApp({ route: '/profile' });

    const name = await screen.findByLabelText('Name');
    expect(name).toHaveValue('Ana Admin');
    await user.clear(name);
    await user.type(name, 'Ana A.');
    await user.click(screen.getByRole('button', { name: 'Save name' }));

    expect(await screen.findByText('Name saved.')).toBeInTheDocument();
    expect(requests.patch).toEqual([{ name: 'Ana A.' }]);
  });

  it('shows a validation error for an empty name', async () => {
    const requests = profileHandlers(activeUser);
    const user = userEvent.setup();
    renderApp({ route: '/profile' });

    await user.clear(await screen.findByLabelText('Name'));
    await user.click(screen.getByRole('button', { name: 'Save name' }));

    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(requests.patch).toEqual([]);
  });

  it('sends a password reset email to the account address', async () => {
    const requests = profileHandlers(activeUser);
    const user = userEvent.setup();
    renderApp({ route: '/profile' });

    await user.click(await screen.findByRole('button', { name: 'Send password reset email' }));

    expect(await screen.findByText(/Check ana@example.com for a link/)).toBeInTheDocument();
    expect(requests.reset).toEqual([{ email: 'ana@example.com' }]);
  });

  it('is not shown before the profile is complete', async () => {
    profileHandlers({ ...pendingUser, emailVerified: false, profileComplete: false });
    renderApp({ route: '/profile' });

    expect(
      await screen.findByRole('heading', { name: 'Complete your profile' }),
    ).toBeInTheDocument();
  });
});
