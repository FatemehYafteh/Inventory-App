import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from './api';

export const ME_QUERY_KEY = ['auth', 'me'];

/** The signed-in user, or null when there is no session. `options` adds query options. */
export function useMe(options) {
  return useQuery({
    ...options,
    queryKey: ME_QUERY_KEY,
    queryFn: async () => {
      try {
        const { user } = await api('/auth/me');
        return user;
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return null;
        throw err;
      }
    },
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials) => api('/auth/login', { method: 'POST', body: credentials }),
    onSuccess: ({ user }) => queryClient.setQueryData(ME_QUERY_KEY, user),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST' }),
    onSettled: () => {
      queryClient.clear();
      queryClient.setQueryData(ME_QUERY_KEY, null);
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (values) => api('/auth/register', { method: 'POST', body: values }),
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: (email) => api('/auth/resend-verification', { method: 'POST', body: { email } }),
  });
}

/**
 * Complete profile: saves the name and the email to verify. The answer is generic, so the
 * cached user takes the submitted values (as the server stores them) and is then refetched.
 */
export function useCompleteProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values) => api('/auth/profile/complete', { method: 'POST', body: values }),
    onSuccess: (_data, { name, email }) => {
      queryClient.setQueryData(
        ME_QUERY_KEY,
        (user) => user && { ...user, name, pendingEmail: email },
      );
      return queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
    },
  });
}

/** Resend on the Complete profile "Check your email" screen (the server knows the email). */
export function useResendProfileVerification() {
  return useMutation({
    mutationFn: () => api('/auth/profile/resend-verification', { method: 'POST' }),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email) => api('/auth/forgot-password', { method: 'POST', body: { email } }),
  });
}

export function useResetPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values) => api('/auth/reset-password', { method: 'POST', body: values }),
    // A reset ends every session, so the cached user may no longer be signed in.
    onSuccess: () => queryClient.resetQueries({ queryKey: ME_QUERY_KEY }),
  });
}

/**
 * Submits a verification link token once. It is a query (not an effect) so React Query
 * dedupes it: remounts and StrictMode never spend the single-use token twice.
 */
export function useVerifyEmail(token) {
  return useQuery({
    queryKey: ['auth', 'verify-email', token],
    queryFn: () => api('/auth/verify-email', { method: 'POST', body: { token } }),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/** Where a signed-in user belongs, following the server's access gates. */
export function homePathFor(user) {
  if (!user.profileComplete) return '/complete-profile';
  if (user.status === 'pending') return '/awaiting-approval';
  return '/';
}
