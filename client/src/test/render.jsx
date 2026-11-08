import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@/App';
import { pageLoaders } from '@/pages/loaders';

// Pages load on demand in the app. Load them all once, before any test runs, so a test never
// waits for a page's first import (that is slower than the default one-second wait).
await Promise.all(Object.values(pageLoaders).map((load) => load()));

/** `queryClient` lets a test seed the cache before the app renders. */
export function renderApp({
  route = '/',
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }),
} = {}) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
