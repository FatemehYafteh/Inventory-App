import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { CATEGORIES_QUERY_KEY } from './categories';
import { SUPPLIERS_QUERY_KEY } from './suppliers';

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

function useProductMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    // Success or not, the list reloads; category and supplier product counts may have changed.
    onSettled: () =>
      Promise.all(
        [PRODUCTS_QUERY_KEY, CATEGORIES_QUERY_KEY, SUPPLIERS_QUERY_KEY].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  });
}

/** `{ title, sku, description, category, supplier, price, reorderLevel }` */
export function useCreateProduct() {
  return useProductMutation((body) => api('/products', { method: 'POST', body }));
}

/** `{ id, ...fields }`; `supplier: null` clears the supplier. */
export function useUpdateProduct() {
  return useProductMutation(({ id, ...body }) => api(`/products/${id}`, { method: 'PATCH', body }));
}
