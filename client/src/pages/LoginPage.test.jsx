import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { ACCESS_DENIED_KEY } from '@/lib/auth';
import { renderApp } from '@/test/render';
import { activeUser, notAuthenticated, server } from '@/test/server';

async function fillAndSubmit(user, { email, password }) {
  if (email) await user.type(screen.getByLabelText('Email'), email);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Log in' }));
}

describe('LoginPage', () => {
  it('says "Access denied" after an account was rejected while signed in', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(ACCESS_DENIED_KEY, true);
    renderApp({ route: '/login', queryClient });

    expect(await screen.findByText('Access denied.')).toBeInTheDocument();
  });

  it('shows no access-denied notice by default', async () => {
    renderApp({ route: '/login' });
    await screen.findByRole('heading', { name: 'Log in' });
    expect(screen.queryByText('Access denied.')).not.toBeInTheDocument();
  });

  it('sends a signed-out visitor to the login page', async () => {
    renderApp({ route: '/' });
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });

  it('shows validation messages from the shared schema', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/login' });
    await screen.findByRole('heading', { name: 'Log in' });

    await fillAndSubmit(user, { email: 'not-an-email' });

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows the generic server error on bad credentials', async () => {
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(
          { message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' },
          { status: 401 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderApp({ route: '/login' });
    await screen.findByRole('heading', { name: 'Log in' });

    await fillAndSubmit(user, { email: 'ana@example.com', password: 'wrong-password' });

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });

  it('sends a lowercased, trimmed email and opens the dashboard on success', async () => {
    let sent;
    server.use(
      http.post('*/api/auth/login', async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ user: activeUser });
      }),
    );
    const user = userEvent.setup();
    renderApp({ route: '/login' });
    await screen.findByRole('heading', { name: 'Log in' });

    await fillAndSubmit(user, { email: '  Ana@Example.com ', password: 'correct-horse-battery' });

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(sent).toEqual({ email: 'ana@example.com', password: 'correct-horse-battery' });
  });

  it('sends a pending user to the awaiting-approval screen', async () => {
    const pendingUser = { ...activeUser, status: 'pending' };
    // The awaiting-approval page re-reads the session on mount, so /auth/me must answer too.
    let loggedIn = false;
    server.use(
      http.post('*/api/auth/login', () => {
        loggedIn = true;
        return HttpResponse.json({ user: pendingUser });
      }),
      http.get('*/api/auth/me', () =>
        loggedIn ? HttpResponse.json({ user: pendingUser }) : notAuthenticated(),
      ),
    );
    const user = userEvent.setup();
    renderApp({ route: '/login' });
    await screen.findByRole('heading', { name: 'Log in' });

    await fillAndSubmit(user, { email: 'ana@example.com', password: 'correct-horse-battery' });

    expect(await screen.findByRole('heading', { name: 'Awaiting approval' })).toBeInTheDocument();
  });

  it('offers Email and Telegram as tabs, with Email first', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/login' });
    await screen.findByRole('heading', { name: 'Log in' });

    expect(screen.getByRole('tab', { name: 'Email' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Email')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Continue with Telegram' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Telegram' }));
    expect(screen.getByRole('button', { name: 'Continue with Telegram' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).not.toBeVisible();
  });

  it('keeps what was typed when switching tabs', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/login' });
    await screen.findByRole('heading', { name: 'Log in' });
    await user.type(screen.getByLabelText('Email'), 'ana@example.com');

    await user.click(screen.getByRole('tab', { name: 'Telegram' }));
    await user.click(screen.getByRole('tab', { name: 'Email' }));

    expect(screen.getByLabelText('Email')).toHaveValue('ana@example.com');
  });

  it('redirects a signed-in user away from the login page', async () => {
    server.use(http.get('*/api/auth/me', () => HttpResponse.json({ user: activeUser })));
    renderApp({ route: '/login' });
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('keeps a pending user out of the app pages', async () => {
    server.use(
      http.get('*/api/auth/me', () =>
        HttpResponse.json({ user: { ...activeUser, status: 'pending' } }),
      ),
    );
    renderApp({ route: '/' });
    expect(await screen.findByRole('heading', { name: 'Awaiting approval' })).toBeInTheDocument();
  });
});
