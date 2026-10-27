import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export const USERS_QUERY_KEY = ['users'];

// Admins see new signups without reloading: the navigation badge refreshes on this interval.
const PENDING_COUNT_POLL_MS = 30_000;

function queryString(filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '' && value !== false) params.set(key, String(value));
  }
  return params.toString();
}

/** One page of users: `{ items, total, page, limit }`. Filters: status, search, incomplete, page, limit. */
export function useUsers(filters) {
  return useQuery({
    queryKey: [...USERS_QUERY_KEY, 'list', filters],
    queryFn: () => api(`/users?${queryString(filters)}`),
  });
}

/** One user with their status history, newest change first: `{ user, history }`. */
export function useUser(id) {
  return useQuery({
    queryKey: [...USERS_QUERY_KEY, 'detail', id],
    queryFn: () => api(`/users/${encodeURIComponent(id)}`),
    enabled: Boolean(id),
  });
}

/** How many complete profiles wait for approval, for the badge in the navigation. */
export function usePendingCount({ enabled }) {
  return useQuery({
    queryKey: [...USERS_QUERY_KEY, 'pending-count'],
    queryFn: async () => (await api('/users/pending-count')).count,
    enabled,
    refetchInterval: PENDING_COUNT_POLL_MS,
  });
}

function useUserChange(path) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => api(`/users/${id}/${path}`, { method: 'PATCH', body }),
    // Success or not (another admin may have acted first), the lists and the badge reload.
    onSettled: () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
  });
}

/** Approve, reject or reactivate: `{ id, status, reason? }`. */
export function useChangeStatus() {
  return useUserChange('status');
}

/** Promote or demote an active user: `{ id, role }`. */
export function useChangeRole() {
  return useUserChange('role');
}
