import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from './api';

export const MOVEMENTS_QUERY_KEY = ['movements'];

/** `?a=1&b=2` for the filters that are set; an empty value is left out. */
export function movementsQueryString(filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return params.toString();
}

/**
 * One page of all stock movements, newest first: `{ items, total, page, limit }`. Filters:
 * product, type, supplier, user, from, to (full ISO instants, `to` exclusive), page, limit. Each
 * item has product { id, title, sku }, type, quantityChange, quantityBefore, quantityAfter,
 * supplier (or null), note and performedBy { id, name, role }.
 */
export function useStockMovements(filters) {
  return useQuery({
    queryKey: [...MOVEMENTS_QUERY_KEY, 'list', filters],
    queryFn: () => api(`/movements?${movementsQueryString(filters)}`),
    placeholderData: keepPreviousData,
  });
}

/** Everyone who made a movement, for the "performed by" filter: `{ items: [{ id, name }] }`. */
export function usePerformers() {
  return useQuery({
    queryKey: [...MOVEMENTS_QUERY_KEY, 'performers'],
    queryFn: () => api('/movements/performers'),
  });
}
