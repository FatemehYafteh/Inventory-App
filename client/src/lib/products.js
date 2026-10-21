import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { api } from './api';
import { CATEGORIES_QUERY_KEY } from './categories';
import { MOVEMENTS_QUERY_KEY } from './movements';
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

/** One product, for showing the name behind a product id in a link: `{ product }`. */
export function useProduct(id) {
  return useQuery({
    queryKey: [...PRODUCTS_QUERY_KEY, 'detail', id],
    queryFn: () => api(`/products/${id}`),
    enabled: Boolean(id),
  });
}

function useProductMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    // Success or not, the list reloads; category and supplier product counts may have changed.
    onSettled: () =>
      Promise.all(
        [PRODUCTS_QUERY_KEY, CATEGORIES_QUERY_KEY, SUPPLIERS_QUERY_KEY, MOVEMENTS_QUERY_KEY].map(
          (queryKey) => queryClient.invalidateQueries({ queryKey }),
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

/** The product id. Admin only; the API answers 409 if it is already archived. */
export function useArchiveProduct() {
  return useProductMutation((id) => api(`/products/${id}/archive`, { method: 'PATCH' }));
}

/** The product id. Admin only; the API answers 409 if it is not archived. */
export function useRestoreProduct() {
  return useProductMutation((id) => api(`/products/${id}/restore`, { method: 'PATCH' }));
}

// Same rule as the server: stock status is derived from quantity and reorder level.
function stockStatusOf(quantity, reorderLevel) {
  if (quantity === 0) return 'out_of_stock';
  return quantity <= reorderLevel ? 'low_stock' : 'in_stock';
}

/** Adds `delta` to one product's quantity in every cached list page. */
function patchQuantity(queryClient, id, delta) {
  queryClient.setQueriesData(
    { queryKey: [...PRODUCTS_QUERY_KEY, 'list'] },
    (page) =>
      page && {
        ...page,
        items: page.items.map((item) => {
          if (item.id !== id) return item;
          const quantity = Math.max(0, item.quantity + delta);
          return { ...item, quantity, stockStatus: stockStatusOf(quantity, item.reorderLevel) };
        }),
      },
  );
}

/**
 * The inline +/- buttons. `step(product, delta, { onError })` takes `delta` 1 or -1: it changes
 * the quantity in the cached lists at once, then sends one `increment` or `decrement`. A product's
 * requests go one after another, so rapid clicks each reach the server in order; the server
 * applies a delta, never an absolute value. A failed request takes back only its own change, and
 * the lists reload from the server once a product has nothing left in flight.
 */
export function useStockStep() {
  const queryClient = useQueryClient();
  const queues = useRef(new Map());

  return useCallback(
    (product, delta, { onError } = {}) => {
      const { id } = product;
      const queue = queues.current.get(id) ?? { tail: Promise.resolve(), inFlight: 0 };
      queues.current.set(id, queue);
      queue.inFlight += 1;

      const listKey = [...PRODUCTS_QUERY_KEY, 'list'];
      const applied = queryClient
        .cancelQueries({ queryKey: listKey })
        .then(() => patchQuantity(queryClient, id, delta));

      queue.tail = Promise.all([applied, queue.tail])
        .then(() =>
          api(`/products/${id}/stock`, {
            method: 'POST',
            body: { type: delta > 0 ? 'increment' : 'decrement' },
          }),
        )
        .catch((error) => {
          patchQuantity(queryClient, id, -delta);
          onError?.(error);
        })
        .finally(() => {
          queue.inFlight -= 1;
          if (queue.inFlight > 0) return;
          queues.current.delete(id);
          return Promise.all(
            [
              PRODUCTS_QUERY_KEY,
              CATEGORIES_QUERY_KEY,
              SUPPLIERS_QUERY_KEY,
              MOVEMENTS_QUERY_KEY,
            ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
          );
        });
    },
    [queryClient],
  );
}

/** `{ id, type, quantity, note }` with `type` receive, ship or adjust; the lists reload after. */
export function useChangeStock() {
  return useProductMutation(({ id, ...body }) =>
    api(`/products/${id}/stock`, { method: 'POST', body }),
  );
}

/**
 * One page of a product's movements, newest first: `{ items, total, page, limit }`. Each item has
 * type, quantityChange, quantityBefore, quantityAfter, supplier (or null), note and
 * `performedBy { id, name }`. Pass a null `id` to leave it idle.
 */
export function useMovements(id, { page, limit }) {
  return useQuery({
    queryKey: [...PRODUCTS_QUERY_KEY, 'movements', id, { page, limit }],
    queryFn: () => api(`/products/${id}/movements?page=${page}&limit=${limit}`),
    enabled: Boolean(id),
    placeholderData: keepPreviousData,
  });
}
