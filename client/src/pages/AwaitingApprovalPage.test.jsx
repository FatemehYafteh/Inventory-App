import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '@/test/render';
import { activeUser, server } from '@/test/server';

const pendingUser = { ...activeUser, name: 'Pat Pending', role: 'staff', status: 'pending' };

afterEach(() => vi.useRealTimers());

describe('AwaitingApprovalPage', () => {
  it('opens the app on its own once an admin approves the account', async () => {
    let user = pendingUser;
    const me = vi.fn(() => HttpResponse.json({ user }));
    server.use(http.get('*/api/auth/me', me));
    vi.useFakeTimers({ shouldAdvanceTime: true });

    renderApp({ route: '/awaiting-approval' });
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

    renderApp({ route: '/awaiting-approval' });
    await screen.findByRole('heading', { name: 'Awaiting approval' });
    const initialLoads = me.mock.calls.length;

    await vi.advanceTimersByTimeAsync(30_000);

    expect(me.mock.calls.length).toBeGreaterThanOrEqual(initialLoads + 3);
    expect(screen.getByRole('heading', { name: 'Awaiting approval' })).toBeInTheDocument();
  });
});
