import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/data-table/DataTable';
import { renderCell } from '@/components/data-table/renderCell';
import { StatusBadge } from '@/components/StatusBadge';
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

function Actions({
  user,
  isYou,
  busy,
  readOnly,
  onApprove,
  onReject,
  onReactivate,
  onChangeRole,
}) {
  const { t } = useTranslation();
  const buttons = [];
  // Why the buttons the rules disable are disabled: a tooltip on them, and a note under them.
  const note =
    {
      pending: !user.profileComplete && t('users.actions.pendingIncompleteNote'),
      active: isYou && t('users.actions.selfNote'),
      rejected: !user.profileComplete && t('users.actions.rejectedIncompleteNote'),
    }[user.status] || null;
  // A demo account sees every action, all disabled; the page says why once, above the table.
  const demoTitle = readOnly ? t('users.actions.demoNote') : undefined;
  const title = demoTitle || note || undefined;
  const locked = busy || readOnly;

  if (user.status === 'pending') {
    buttons.push(
      <Button
        key="approve"
        size="sm"
        disabled={locked || !user.profileComplete}
        title={title}
        onClick={() => onApprove(user)}
      >
        {t('users.actions.approve')}
      </Button>,
      <Button
        key="reject"
        size="sm"
        variant="outline"
        disabled={locked}
        title={demoTitle}
        onClick={() => onReject(user)}
      >
        {t('users.actions.reject')}
      </Button>,
    );
  } else if (user.status === 'active') {
    buttons.push(
      <Button
        key="reject"
        size="sm"
        variant="outline"
        disabled={locked || isYou}
        title={title}
        onClick={() => onReject(user)}
      >
        {t('users.actions.reject')}
      </Button>,
      <Button
        key="role"
        size="sm"
        variant="outline"
        disabled={locked || isYou}
        title={title}
        onClick={() => onChangeRole(user)}
      >
        {user.role === 'admin' ? t('users.actions.makeStaff') : t('users.actions.makeAdmin')}
      </Button>,
    );
  } else {
    buttons.push(
      <Button
        key="active"
        size="sm"
        disabled={locked || !user.profileComplete}
        title={title}
        onClick={() => onReactivate(user, 'active')}
      >
        {t('users.actions.reactivate')}
      </Button>,
      <Button
        key="pending"
        size="sm"
        variant="outline"
        disabled={locked}
        title={demoTitle}
        onClick={() => onReactivate(user, 'pending')}
      >
        {t('users.actions.moveToPending')}
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
      {note && !readOnly && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

/**
 * The users table. The server filters and pages; `pagination` is { pageIndex, pageSize }.
 * Row actions call the handlers; `busy` disables them while a change is being saved, and
 * `readOnly` (the demo account) disables them all.
 */
export function UsersTable({
  users,
  total,
  meId,
  busy,
  readOnly = false,
  pagination,
  onPaginationChange,
  isLoading,
  error,
  onRetry,
  emptyMessage,
  toolbar,
  onApprove,
  onReject,
  onReactivate,
  onChangeRole,
  onOpen,
}) {
  const { t } = useTranslation();
  const columns = useMemo(
    () => [
      {
        id: 'name',
        header: t('users.table.name'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-medium">
            <button
              type="button"
              onClick={() => onOpen(row.original)}
              className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {row.original.name ? <bdi>{row.original.name}</bdi> : t('users.table.noName')}
            </button>
            {row.original.id === meId && (
              <span className="text-muted-foreground">{t('users.table.you')}</span>
            )}
          </span>
        ),
      },
      {
        id: 'email',
        header: t('users.table.email'),
        enableSorting: false,
        cell: ({ row }) => <EmailCell user={row.original} />,
      },
      {
        id: 'telegram',
        header: t('users.table.telegram'),
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
        header: t('users.table.methods'),
        enableSorting: false,
        cell: ({ row }) => <SignInMethods user={row.original} />,
      },
      {
        id: 'role',
        header: t('users.table.role'),
        enableSorting: false,
        cell: ({ row }) => (
          <Badge variant="secondary">{t(`users.role.${row.original.role}`)}</Badge>
        ),
      },
      {
        id: 'status',
        header: t('users.table.status'),
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            {/* label keeps the stored lower-case text; only the colour comes from the status. */}
            <StatusBadge
              status={row.original.status}
              label={t(`users.status.${row.original.status}`)}
            />
            {row.original.status === 'rejected' && row.original.statusReason && (
              <span className="text-xs text-muted-foreground">
                <bdi>{row.original.statusReason}</bdi>
              </span>
            )}
          </div>
        ),
      },
      {
        id: 'createdAt',
        header: t('users.table.createdAt'),
        enableSorting: false,
        cell: ({ row }) => (
          <NoWrapOnRejected user={row.original}>
            {formatDate(row.original.createdAt)}
          </NoWrapOnRejected>
        ),
      },
      {
        id: 'lastLoginAt',
        header: t('users.table.lastLoginAt'),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.lastLoginAt ? (
            <NoWrapOnRejected user={row.original}>
              {formatDate(row.original.lastLoginAt)}
            </NoWrapOnRejected>
          ) : (
            <span className="text-muted-foreground">{t('users.table.never')}</span>
          ),
      },
      {
        id: 'actions',
        header: t('users.table.actions'),
        enableSorting: false,
        cell: ({ row }) => (
          <Actions
            user={row.original}
            isYou={row.original.id === meId}
            busy={busy}
            readOnly={readOnly}
            onApprove={onApprove}
            onReject={onReject}
            onReactivate={onReactivate}
            onChangeRole={onChangeRole}
          />
        ),
      },
    ],
    [t, meId, busy, readOnly, onApprove, onReject, onReactivate, onChangeRole, onOpen],
  );

  // Below md each user is a card: name, email, role and status, and the row actions.
  const renderCard = (user) => {
    const cell = (id) => renderCell(columns, id, user);
    return (
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-0.5 [overflow-wrap:anywhere]">
          {cell('name')}
          {cell('email')}
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {cell('role')}
          {cell('status')}
        </div>
        {cell('actions')}
      </div>
    );
  };

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
      onRetry={onRetry}
      emptyMessage={emptyMessage}
      toolbar={toolbar}
      renderCard={renderCard}
    />
  );
}
