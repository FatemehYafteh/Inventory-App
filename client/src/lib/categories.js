import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export const CATEGORIES_QUERY_KEY = ['categories'];

/** Every category by title: `{ items: [{ id, title, description, productCount, ... }] }`. */
export function useCategories() {
  return useQuery({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: () => api('/categories'),
  });
}

function useCategoryMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    // Success or not (the counts may have changed under us), the list reloads.
    onSettled: () => queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY }),
  });
}

/** `{ title, description }` */
export function useCreateCategory() {
  return useCategoryMutation((body) => api('/categories', { method: 'POST', body }));
}

/** `{ id, title, description }` */
export function useUpdateCategory() {
  return useCategoryMutation(({ id, ...body }) =>
    api(`/categories/${id}`, { method: 'PATCH', body }),
  );
}

/** The category id. */
export function useDeleteCategory() {
  return useCategoryMutation((id) => api(`/categories/${id}`, { method: 'DELETE' }));
}
