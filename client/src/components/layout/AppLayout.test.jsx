import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { activeUser, server } from '@/test/server';

/** Serves `user` from /me until logout is called, then answers like a signed-out session. */
function signedInUntilLogout(user) {
  const state = { loggedOut: false, logoutCalls: 0 };
  server.use(
    http.get('*/api/auth/me', () =>
      state.loggedOut
        ? HttpResponse.json(
            { code: 'NOT_AUTHENTICATED', message: 'Please log in.' },
            { status: 401 },
          )
        : HttpResponse.json({ user }),
    ),
    http.get('*/api/users', () => HttpResponse.json({ items: [], total: 0, page: 1, limit: 20 })),
    http.get('*/api/users/pending-count', () => HttpResponse.json({ count: 0 })),
    http.post('*/api/auth/logout', () => {
      state.loggedOut = true;
      state.logoutCalls += 1;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return state;
}

describe('Log out', () => {
  it.each([
    ['an admin on the dashboard', { ...activeUser, role: 'admin' }, '/'],
    ['an admin on the Users page', { ...activeUser, role: 'admin' }, '/users'],
    ['a staff user on the dashboard', { ...activeUser, role: 'staff' }, '/'],
  ])('signs %s out and shows the login page', async (_label, user, route) => {
    const state = signedInUntilLogout(user);
    renderApp({ route });
    const button = await screen.findByRole('button', { name: 'Log out' });

    await userEvent.setup().click(button);

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(state.logoutCalls).toBe(1);
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
  });

  it('shows the next user to sign in none of the previous user data', async () => {
    const admin = { ...activeUser, id: 'a1', name: 'Ana Admin', role: 'admin' };
    const staff = { ...activeUser, id: 's1', name: 'Sam Staff', role: 'staff' };
    const waiting = {
      id: 'p1',
      name: 'Pat Pending',
      email: 'pat@example.com',
      emailVerified: true,
      hasPassword: true,
      hasTelegram: false,
      role: 'staff',
      status: 'pending',
      profileComplete: true,
      createdAt: '2026-09-01T10:00:00.000Z',
      lastLoginAt: null,
    };
    const session = { user: admin };
    server.use(
      http.get('*/api/auth/me', () =>
        session.user
          ? HttpResponse.json({ user: session.user })
          : HttpResponse.json(
              { code: 'NOT_AUTHENTICATED', message: 'Please log in.' },
              { status: 401 },
            ),
      ),
      http.get('*/api/users', () =>
        HttpResponse.json({ items: [waiting], total: 1, page: 1, limit: 20 }),
      ),
      http.get('*/api/users/pending-count', () => HttpResponse.json({ count: 3 })),
      http.post('*/api/auth/logout', () => {
        session.user = null;
        return new HttpResponse(null, { status: 204 });
      }),
      http.post('*/api/auth/login', () => {
        session.user = staff;
        return HttpResponse.json({ user: staff });
      }),
    );
    const user = userEvent.setup();
    renderApp({ route: '/users' });
    expect(await screen.findByRole('row', { name: /Pat Pending/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Log out' }));
    await screen.findByRole('heading', { name: 'Log in' });
    await user.type(screen.getByLabelText('Email'), 'sam@example.com');
    await user.type(screen.getByLabelText('Password'), 'any-password-here');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText(/Welcome, Sam Staff/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Users/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Pat Pending')).not.toBeInTheDocument();
    expect(screen.queryByText('Ana Admin')).not.toBeInTheDocument();
  });
});
