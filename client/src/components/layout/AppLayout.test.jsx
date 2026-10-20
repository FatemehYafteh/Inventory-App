import { screen, waitFor, within } from '@testing-library/react';
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

describe('Navigation shell', () => {
  it.each([
    ['an admin', 'admin', ['Dashboard', 'Products', 'Categories', 'Suppliers', 'Users']],
    ['a staff user', 'staff', ['Dashboard', 'Products', 'Categories', 'Suppliers']],
  ])('lists the pages %s can open in the Main navigation', async (_label, role, expected) => {
    signedInUntilLogout({ ...activeUser, role });
    renderApp({ route: '/' });

    const nav = await screen.findByRole('navigation', { name: 'Main' });
    const names = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent.trim());

    expect(names).toEqual(expected);
  });

  it('marks the current page and counts users waiting for approval', async () => {
    signedInUntilLogout({ ...activeUser, role: 'admin' });
    server.use(http.get('*/api/users/pending-count', () => HttpResponse.json({ count: 3 })));
    renderApp({ route: '/' });

    const nav = await screen.findByRole('navigation', { name: 'Main' });

    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      await within(nav).findByRole('link', { name: /Users\s*3\s*waiting for approval/ }),
    ).toBeInTheDocument();
  });

  it('lets a keyboard user skip the navigation to the page content', async () => {
    signedInUntilLogout({ ...activeUser, role: 'staff' });
    const user = userEvent.setup();
    renderApp({ route: '/' });
    await screen.findByRole('navigation', { name: 'Main' });

    await user.tab();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('opens the same navigation and Log out in a menu, and closes it after choosing a page', async () => {
    signedInUntilLogout({ ...activeUser, role: 'staff' });
    const user = userEvent.setup();
    renderApp({ route: '/' });
    await screen.findByRole('navigation', { name: 'Main' });

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const menu = await screen.findByRole('dialog', { name: 'Menu' });

    expect(within(menu).getByRole('link', { name: 'Suppliers' })).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: 'Log out' })).toBeInTheDocument();

    await user.click(within(menu).getByRole('link', { name: 'Dashboard' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('Minimal layout', () => {
  it('gives a pending user a skip link and a way back, without the app navigation', async () => {
    signedInUntilLogout({ ...activeUser, role: 'staff', status: 'pending' });
    renderApp({ route: '/profile' });

    expect(await screen.findByRole('link', { name: 'Skip to main content' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Awaiting approval' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });
});
