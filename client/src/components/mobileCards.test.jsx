import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { SupplierTable } from '@/components/suppliers/SupplierTable';
import { UsersTable } from '@/components/users/UsersTable';
import { mockMobile } from '@/test/mobile';

const noop = () => {};
const paging = { pageIndex: 0, pageSize: 20 };

describe('Tables as cards on a phone', () => {
  let restore = () => {};
  afterEach(() => restore());

  it('shows a supplier as a card: name, inactive badge, contacts as links, count and actions', () => {
    restore = mockMobile();
    const supplier = {
      id: 's1',
      name: 'Old Mill Paper Co.',
      contactPerson: 'Sara Hill',
      phone: '+1 555 0100',
      email: 'orders@oldmill.example.com',
      isActive: false,
      productCount: 1234,
      movementCount: 0,
    };
    render(
      <MemoryRouter>
        <SupplierTable
          suppliers={[supplier]}
          total={1}
          canManage
          busy={false}
          sorting={[]}
          onSortingChange={noop}
          pagination={paging}
          onPaginationChange={noop}
          isLoading={false}
          error={null}
          onEdit={noop}
          onToggleActive={noop}
          onDelete={noop}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const card = within(screen.getByRole('listitem'));
    expect(card.getByRole('link', { name: 'Old Mill Paper Co.' })).toBeInTheDocument();
    expect(card.getByText('Inactive')).toBeInTheDocument();
    expect(card.getByText('Sara Hill')).toBeInTheDocument();
    const phone = card.getByRole('link', { name: '+1 555 0100' });
    expect(phone).toHaveAttribute('href', 'tel:+15550100');
    expect(phone).toHaveAttribute('dir', 'ltr');
    const email = card.getByRole('link', { name: 'orders@oldmill.example.com' });
    expect(email).toHaveAttribute('href', 'mailto:orders@oldmill.example.com');
    expect(email).toHaveAttribute('dir', 'ltr');
    expect(card.getByText('1234')).toBeInTheDocument();
    expect(card.getByRole('button', { name: 'Edit Old Mill Paper Co.' })).toBeInTheDocument();
    expect(
      card.getByRole('button', { name: 'More actions for Old Mill Paper Co.' }),
    ).toBeInTheDocument();
    // Sortable by name, so the Sort by select is offered.
    expect(screen.getByLabelText('Sort by')).toBeInTheDocument();
  });

  it('shows a user as a card: name, email, role and status badges, and the row actions', () => {
    restore = mockMobile();
    const user = {
      id: 'u1',
      name: 'Ana Admin',
      email: 'ana@example.com',
      emailVerified: true,
      profileComplete: true,
      role: 'staff',
      status: 'active',
      createdAt: '2026-10-14T10:00:00.000Z',
    };
    render(
      <UsersTable
        users={[user]}
        total={1}
        meId="someone-else"
        busy={false}
        pagination={paging}
        onPaginationChange={noop}
        isLoading={false}
        error={null}
        emptyMessage="No users."
        onApprove={noop}
        onReject={noop}
        onReactivate={noop}
        onChangeRole={noop}
        onOpen={noop}
      />,
    );

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const card = within(screen.getByRole('listitem'));
    expect(card.getByRole('button', { name: 'Ana Admin' })).toBeInTheDocument();
    expect(card.getByText('ana@example.com')).toBeInTheDocument();
    expect(card.getByText('Staff')).toBeInTheDocument();
    expect(card.getByText('active')).toBeInTheDocument();
    expect(card.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    expect(card.getByRole('button', { name: 'Make admin' })).toBeInTheDocument();
  });
});

describe('Dashboard summary cards on a phone', () => {
  it('puts two cards in a row, tighter, with a number that wraps instead of overflowing', () => {
    render(
      <MemoryRouter>
        <SummaryCards
          summary={{
            activeProducts: 1234,
            totalUnits: 5678,
            inventoryValue: 9876543210.5,
            lowStockCount: 1,
            outOfStockCount: 0,
          }}
          pending={3}
        />
      </MemoryRouter>,
    );

    const grid = screen.getByLabelText('Inventory summary');
    expect(grid).toHaveClass('grid-cols-2', 'sm:gap-4');
    const value = screen.getByText('$9,876,543,210.50');
    expect(value).toHaveClass('text-lg', 'sm:text-2xl', '[overflow-wrap:anywhere]');
    expect(value.closest('div')).toHaveClass('p-3', 'sm:p-4');
  });
});
