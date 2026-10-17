import { QueryClient } from '@tanstack/react-query';
import { setAccessDeniedHandler, setSessionExpiredHandler } from './api';
import { ACCESS_DENIED_KEY, ME_QUERY_KEY } from './auth';

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

// The server refused a call the page thought it could make. A rejected account is signed out
// (the guards show login, which says why); a changed status or profile is reloaded, and the
// guards send the person to Awaiting approval or Complete profile.
setAccessDeniedHandler((code) => {
  if (code === 'ACCOUNT_REJECTED') {
    queryClient.setQueryData(ACCESS_DENIED_KEY, true);
    queryClient.setQueryData(ME_QUERY_KEY, null);
  } else {
    queryClient.refetchQueries({ queryKey: ME_QUERY_KEY });
  }
});
