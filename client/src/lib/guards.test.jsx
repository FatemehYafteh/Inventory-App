import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { activeUser, server } from '@/test/server';
import { RequireAdmin } from './guards';

function renderAdminRoute(user) {
  server.use(http.get('*/api/auth/me', () => HttpResponse.json({ user })));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin-only']}>
        <Routes>
          <Route index element={<p>Dashboard home</p>} />
          <Route element={<RequireAdmin />}>
            <Route path="/admin-only" element={<p>Secret admin page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RequireAdmin', () => {
  it('shows the page to an admin', async () => {
    renderAdminRoute({ ...activeUser, role: 'admin' });
    expect(await screen.findByText('Secret admin page')).toBeInTheDocument();
  });

  it('sends staff to the dashboard', async () => {
    renderAdminRoute({ ...activeUser, role: 'staff' });
    expect(await screen.findByText('Dashboard home')).toBeInTheDocument();
    expect(screen.queryByText('Secret admin page')).not.toBeInTheDocument();
  });
});
