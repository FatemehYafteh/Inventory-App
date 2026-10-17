import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { ME_QUERY_KEY } from './auth';

const POLL_MS = 2000;
// Statuses after which the request can no longer change, so polling stops.
const FINAL_STATUSES = new Set(['verified', 'refused', 'rate_limited', 'locked', 'expired']);

function statusKey(requestId) {
  return ['auth', 'telegram', 'status', requestId];
}

/**
 * The server counts in seconds from now (so the browser's clock does not matter); turn them
 * into local deadlines when the answer arrives.
 */
function withDeadlines(status) {
  if (status.status !== 'otp_sent') return status;
  const now = Date.now();
  return {
    ...status,
    codeExpiresAt: now + status.codeExpiresIn * 1000,
    resendAt: now + status.resendIn * 1000,
  };
}

function useStartRequest(path) {
  return useMutation({ mutationFn: (body) => api(path, { method: 'POST', body }) });
}

/**
 * Continue with Telegram: creates a sign-in request and returns `{ requestId, deepLink }`.
 * After a wrong code, `mutate({ previousRequestId })` replaces that request with a new one.
 */
export function useTelegramStart() {
  return useStartRequest('/auth/telegram/start');
}

/** Connect Telegram (Profile page): the same, for the signed-in user. */
export function useTelegramConnectStart() {
  return useStartRequest('/auth/telegram/connect/start');
}

/**
 * Polls a sign-in request every 2 s until it reaches a final status. With a code sent it
 * also holds `codeExpiresAt` and `resendAt` (local timestamps) and `attemptsLeft`.
 */
export function useTelegramStatus(requestId) {
  return useQuery({
    queryKey: statusKey(requestId),
    queryFn: async () =>
      withDeadlines(await api(`/auth/telegram/status?requestId=${encodeURIComponent(requestId)}`)),
    enabled: Boolean(requestId),
    refetchInterval: (query) => (FINAL_STATUSES.has(query.state.data?.status) ? false : POLL_MS),
  });
}

/** Asks for a new code; the answer is the request's new status. */
export function useTelegramResend(requestId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      withDeadlines(await api('/auth/telegram/resend', { method: 'POST', body: { requestId } })),
    onSuccess: (status) => queryClient.setQueryData(statusKey(requestId), status),
  });
}

/** Sends the code. On success the user is stored and the route guards move them on. */
export function useTelegramVerify() {
  return useVerifyCode('/auth/telegram/verify');
}

/** Connect Telegram: sends the code; on success the stored user shows Telegram connected. */
export function useTelegramConnectVerify() {
  return useVerifyCode('/auth/telegram/connect/verify');
}

function useVerifyCode(path) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values) => api(path, { method: 'POST', body: values }),
    onSuccess: ({ user }) => queryClient.setQueryData(ME_QUERY_KEY, user),
    onError: (error, { requestId }) => {
      if (error.code !== 'TOO_MANY_ATTEMPTS') return;
      // Show "Too many wrong codes" now rather than at the next poll.
      queryClient.setQueryData(statusKey(requestId), (old) => old && { ...old, attemptsLeft: 0 });
    },
  });
}
