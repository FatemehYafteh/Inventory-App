import { QueryClient } from '@tanstack/react-query';
import { setSessionExpiredHandler } from './api';
import { ME_QUERY_KEY } from './auth';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => (error?.status >= 400 && error?.status < 500 ? false : count < 2),
    },
  },
});

// Dropping the user makes the route guards send the person to the login page.
setSessionExpiredHandler(() => {
  queryClient.setQueryData(ME_QUERY_KEY, null);
});
