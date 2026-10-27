import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export const SUPPLIERS_QUERY_KEY = ['suppliers'];

function queryString(filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return params.toString();
}

/**
 * One page of suppliers: `{ items, total, page, limit }`. Filters: search, sortBy, order, page,
 * limit. Each item carries `productCount` and `movementCount`.
 */
export function useSuppliers(filters) {
  return useQuery({
    queryKey: [...SUPPLIERS_QUERY_KEY, 'list', filters],
    queryFn: () => api(`/suppliers?${queryString(filters)}`),
  });
}

function useSupplierMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    // Success or not (the counts may have changed under us), the list reloads.
    onSettled: () => queryClient.invalidateQueries({ queryKey: SUPPLIERS_QUERY_KEY }),
  });
}

/** `{ name, contactPerson, phone, email, address, notes }` */
export function useCreateSupplier() {
  return useSupplierMutation((body) => api('/suppliers', { method: 'POST', body }));
}

/** `{ id, ...fields }`; `{ id, isActive }` deactivates or reactivates. */
export function useUpdateSupplier() {
  return useSupplierMutation(({ id, ...body }) =>
    api(`/suppliers/${id}`, { method: 'PATCH', body }),
  );
}

/** The supplier id. */
export function useDeleteSupplier() {
  return useSupplierMutation((id) => api(`/suppliers/${id}`, { method: 'DELETE' }));
}
