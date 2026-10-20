import { useMemo } from 'react';
import { DataTable } from '@/components/data-table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmailCell, SignInMethods, formatDate } from '@/components/users/userDisplay';

const NO_SORTING = [];

/** Keeps a rejected user's dates on one line; other tabs wrap as before. */
function NoWrapOnRejected({ user, children }) {
  return (
    <span className={user.status === 'rejected' ? 'whitespace-nowrap' : undefined}>{children}</span>
  );
}

function Actions({ user, isYou, busy, onApprove, onReject, onReactivate, onChangeRole }) {
  const buttons = [];
  // Why the buttons the rules disable are disabled: a tooltip on them, and a note under them.
  const note =
    {
      pending:
        !user.profileComplete && 'They must finish their profile before they can be approved.',
      active: isYou && 'You cannot reject or demote yourself.',
      rejected:
        !user.profileComplete && 'They must finish their profile before they can be reactivated.',
    }[user.status] || null;
  const title = note || undefined;

  if (user.status === 'pending') {
    buttons.push(
      <Button
        key="approve"
        size="sm"
        disabled={busy || !user.profileComplete}
        title={title}
        onClick={() => onApprove(user)}
      >
        Approve
      </Button>,
      <Button
        key="reject"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => onReject(user)}
      >
        Reject
      </Button>,
    );
  } else if (user.status === 'active') {
    buttons.push(
      <Button
        key="reject"
        size="sm"
        variant="outline"
        disabled={busy || isYou}
        title={title}
        onClick={() => onReject(user)}
      >
        Reject
      </Button>,
      <Button
        key="role"
        size="sm"
        variant="outline"
        disabled={busy || isYou}
        title={title}
        onClick={() => onChangeRole(user)}
      >
        {user.role === 'admin' ? 'Make staff' : 'Make admin'}
      </Button>,
    );
  } else {
    buttons.push(
      <Button
        key="active"
        size="sm"
        disabled={busy || !user.profileComplete}
        title={title}
        onClick={() => onReactivate(user, 'active')}
      >
        Reactivate
      </Button>,
      <Button
        key="pending"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => onReactivate(user, 'pending')}
      >
        Move to pending
      </Button>,
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div
        className={`flex gap-2 ${user.status === 'rejected' ? 'flex-nowrap whitespace-nowrap' : 'flex-wrap'}`}
      >
        {buttons}
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

/**
 * The users table. The server filters and pages; `pagination` is { pageIndex, pageSize }.
 * Row actions call the handlers; `busy` disables them while a change is being saved.
 */
export function UsersTable({
  users,
  total,
  meId,
  busy,
  pagination,
  onPaginationChange,
  isLoading,
  error,
  emptyMessage,
  toolbar,
  onApprove,
  onReject,
  onReactivate,
  onChangeRole,
  onOpen,
}) {
  const columns = useMemo(
    () => [
      {
        id: 'name',
        header: 'Name',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-medium">
            <button
              type="button"
              onClick={() => onOpen(row.original)}
              className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {row.original.name ?? 'No name yet'}
            </button>
            {row.original.id === meId && <span className="text-muted-foreground"> (you)</span>}
          </span>
        ),
      },
      {
        id: 'email',
        header: 'Email',
        enableSorting: false,
        cell: ({ row }) => <EmailCell user={row.original} />,
      },
      {
        id: 'telegram',
        header: 'Telegram',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.telegramUsername ? (
            `@${row.original.telegramUsername}`
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'methods',
        header: 'Sign-in methods',
        enableSorting: false,
        cell: ({ row }) => <SignInMethods user={row.original} />,
      },
      {
        id: 'role',
        header: 'Role',
        enableSorting: false,
        cell: ({ row }) => <Badge variant="secondary">{row.original.role}</Badge>,
      },
      {
        id: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <Badge variant={row.original.status === 'rejected' ? 'destructive' : 'outline'}>
              {row.original.status}
            </Badge>
            {row.original.status === 'rejected' && row.original.statusReason && (
              <span className="text-xs text-muted-foreground">{row.original.statusReason}</span>
            )}
          </div>
        ),
      },
      {
        id: 'createdAt',
        header: 'Signed up',
        enableSorting: false,
        cell: ({ row }) => (
          <NoWrapOnRejected user={row.original}>
            {formatDate(row.original.createdAt)}
          </NoWrapOnRejected>
        ),
      },
      {
        id: 'lastLoginAt',
        header: 'Last login',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.lastLoginAt ? (
            <NoWrapOnRejected user={row.original}>
              {formatDate(row.original.lastLoginAt)}
            </NoWrapOnRejected>
          ) : (
            <span className="text-muted-foreground">Never</span>
          ),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => (
          <Actions
            user={row.original}
            isYou={row.original.id === meId}
            busy={busy}
            onApprove={onApprove}
            onReject={onReject}
            onReactivate={onReactivate}
            onChangeRole={onChangeRole}
          />
        ),
      },
    ],
    [meId, busy, onApprove, onReject, onReactivate, onChangeRole, onOpen],
  );

  return (
    <DataTable
      columns={columns}
      data={users}
      rowCount={total}
      sorting={NO_SORTING}
      onSortingChange={() => {}}
      pagination={pagination}
      onPaginationChange={onPaginationChange}
      isLoading={isLoading}
      error={error}
      emptyMessage={emptyMessage}
      toolbar={toolbar}
    />
  );
}
