import { QueryClient } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '@/test/render';
import { activeUser, server } from '@/test/server';

const pendingUser = { ...activeUser, name: 'Pat Pending', role: 'staff', status: 'pending' };

afterEach(() => vi.useRealTimers());

// The app keeps the session fresh for 30 s, so mounting the page does not refetch it. The test default
// (0) would add a fetch the real app never makes, and this test counts fetches.
const appQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });

describe('AwaitingApprovalPage', () => {
  it('opens the app on its own once an admin approves the account', async () => {
    let user = pendingUser;
    const me = vi.fn(() => HttpResponse.json({ user }));
    server.use(http.get('*/api/auth/me', me));
    vi.useFakeTimers({ shouldAdvanceTime: true });

    renderApp({ route: '/awaiting-approval', queryClient: appQueryClient() });
    expect(await screen.findByRole('heading', { name: 'Awaiting approval' })).toBeInTheDocument();
    const initialLoads = me.mock.calls.length;

    await vi.advanceTimersByTimeAsync(9_000);
    expect(me).toHaveBeenCalledTimes(initialLoads);

    user = { ...pendingUser, status: 'active' };
    await vi.advanceTimersByTimeAsync(2_000);

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('keeps waiting while the account is still pending', async () => {
    const me = vi.fn(() => HttpResponse.json({ user: pendingUser }));
    server.use(http.get('*/api/auth/me', me));
    vi.useFakeTimers({ shouldAdvanceTime: true });

    renderApp({ route: '/awaiting-approval', queryClient: appQueryClient() });
    await screen.findByRole('heading', { name: 'Awaiting approval' });
    const initialLoads = me.mock.calls.length;

    await vi.advanceTimersByTimeAsync(30_000);

    expect(me.mock.calls.length).toBeGreaterThanOrEqual(initialLoads + 3);
    expect(screen.getByRole('heading', { name: 'Awaiting approval' })).toBeInTheDocument();
  });
});
