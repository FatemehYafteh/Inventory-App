import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { activeUser, server } from '@/test/server';
import { api } from './api';
import { ACCESS_DENIED_KEY, ME_QUERY_KEY, useMe } from './auth';
import { queryClient } from './queryClient';

function denyWith(code) {
  server.use(http.get('*/api/data', () => HttpResponse.json({ code }, { status: 403 })));
  return api('/data').catch(() => {});
}

afterEach(() => queryClient.clear());

describe('access gates in the browser session', () => {
  it('drops the session and flags "Access denied" when the account was rejected', async () => {
    queryClient.setQueryData(ME_QUERY_KEY, activeUser);

    await denyWith('ACCOUNT_REJECTED');

    expect(queryClient.getQueryData(ME_QUERY_KEY)).toBeNull();
    expect(queryClient.getQueryData(ACCESS_DENIED_KEY)).toBe(true);
  });

  it.each(['ACCOUNT_PENDING', 'PROFILE_INCOMPLETE'])(
    'reloads the signed-in user on %s so the guards route them',
    async (code) => {
      let status = 'active';
      server.use(
        http.get('*/api/auth/me', () => HttpResponse.json({ user: { ...activeUser, status } })),
      );
      // The app always has a useMe observer mounted.
      const { result } = renderHook(() => useMe(), {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      });
      await waitFor(() => expect(result.current.data?.status).toBe('active'));

      status = 'pending';
      await denyWith(code);

      await waitFor(() => expect(result.current.data.status).toBe('pending'));
      expect(queryClient.getQueryData(ACCESS_DENIED_KEY)).not.toBe(true);
    },
  );
});
