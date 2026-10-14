import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { ME_QUERY_KEY } from './auth';

const POLL_MS = 2000;
// Statuses after which the request can no longer change, so polling stops.
const FINAL_STATUSES = new Set(['verified', 'refused', 'rate_limited', 'expired']);

/** Continue with Telegram: creates a sign-in request and returns `{ requestId, deepLink }`. */
export function useTelegramStart() {
  return useMutation({
    mutationFn: () => api('/auth/telegram/start', { method: 'POST' }),
  });
}

/** Polls a sign-in request every 2 s until it reaches a final status. */
export function useTelegramStatus(requestId) {
  return useQuery({
    queryKey: ['auth', 'telegram', 'status', requestId],
    queryFn: () => api(`/auth/telegram/status?requestId=${encodeURIComponent(requestId)}`),
    enabled: Boolean(requestId),
    refetchInterval: (query) => (FINAL_STATUSES.has(query.state.data?.status) ? false : POLL_MS),
  });
}

/** Sends the code. On success the user is stored and the route guards move them on. */
export function useTelegramVerify() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values) => api('/auth/telegram/verify', { method: 'POST', body: values }),
    onSuccess: ({ user }) => queryClient.setQueryData(ME_QUERY_KEY, user),
  });
}
