import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SidebarNav } from './SidebarNav';

describe('SidebarNav user row', () => {
  const items = [];
  function setup(user) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SidebarNav items={items} pendingCount={0} user={user} onLogout={() => {}} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it.each([
    ['English', `${'Bartholomew '.repeat(10).trim()}`],
    ['Persian', `${'محمدحسین '.repeat(10).trim()}`],
  ])('truncates a long %s name so the Log out button keeps its place', (_, name) => {
    setup({ name, role: 'admin' });

    const nameEl = screen.getByTitle(name);
    expect(nameEl).toHaveTextContent(name);
    expect(nameEl).toHaveClass('truncate', 'min-w-0');
    expect(nameEl.parentElement).toHaveClass('min-w-0');
    expect(screen.getByText('Admin')).toHaveClass('truncate', 'min-w-0');
    expect(screen.getByRole('link', { name: new RegExp(name.slice(0, 8)) })).toHaveClass('min-w-0');
    const logOut = screen.getByRole('button', { name: 'Log out' });
    expect(logOut).toHaveClass('shrink-0');
  });
});
