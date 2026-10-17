import { useMemo } from 'react';
import { DataTable } from '@/components/data-table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const NO_SORTING = [];
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

const formatDate = (value) => dateFormat.format(new Date(value));

function EmailCell({ user }) {
  if (!user.email) return <span className="text-muted-foreground">No email</span>;
  return (
    <div className="flex flex-col gap-0.5">
      <span>{user.email}</span>
      <span className="text-xs text-muted-foreground">
        {user.emailVerified ? 'Verified' : 'Not verified'}
      </span>
    </div>
  );
}

function SignInMethods({ user }) {
  const methods = [
    user.email && user.hasPassword && 'Email',
    user.hasTelegram && 'Telegram',
  ].filter(Boolean);
  if (!methods.length) return <span className="text-muted-foreground">None yet</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {methods.map((method) => (
        <Badge key={method} variant="outline">
          {method}
        </Badge>
      ))}
    </div>
  );
}

function Actions({ user, isYou, busy, onApprove, onReject, onReactivate, onChangeRole }) {
  const buttons = [];
  let note = null;

  if (user.status === 'pending') {
    buttons.push(
      <Button
        key="approve"
        size="sm"
        disabled={busy || !user.profileComplete}
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
    if (!user.profileComplete) note = 'They must finish their profile before they can be approved.';
  } else if (user.status === 'active') {
    buttons.push(
      <Button
        key="reject"
        size="sm"
        variant="outline"
        disabled={busy || isYou}
        onClick={() => onReject(user)}
      >
        Reject
      </Button>,
      <Button
        key="role"
        size="sm"
        variant="outline"
        disabled={busy || isYou}
        onClick={() => onChangeRole(user)}
      >
        {user.role === 'admin' ? 'Make staff' : 'Make admin'}
      </Button>,
    );
    if (isYou) note = 'You cannot reject or demote yourself.';
  } else {
    buttons.push(
      <Button
        key="active"
        size="sm"
        disabled={busy || !user.profileComplete}
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
    if (!user.profileComplete)
      note = 'They must finish their profile before they can be reactivated.';
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">{buttons}</div>
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
}) {
  const columns = useMemo(
    () => [
      {
        id: 'name',
        header: 'Name',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.name ?? 'No name yet'}
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
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        id: 'lastLoginAt',
        header: 'Last login',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.lastLoginAt ? (
            formatDate(row.original.lastLoginAt)
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
    [meId, busy, onApprove, onReject, onReactivate, onChangeRole],
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
