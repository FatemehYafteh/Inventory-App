import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from './api';

export const PRODUCTS_QUERY_KEY = ['products'];

function queryString(filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return params.toString();
}

/**
 * One page of products: `{ items, total, page, limit }`. Filters: search, category, supplier,
 * status, archived, sortBy, order, page, limit. The previous page stays visible while the next
 * one loads. Each item carries `stockStatus`, `category { id, title }` and `supplier { id, name }`.
 */
export function useProducts(filters) {
  return useQuery({
    queryKey: [...PRODUCTS_QUERY_KEY, 'list', filters],
    queryFn: () => api(`/products?${queryString(filters)}`),
    placeholderData: keepPreviousData,
  });
}
