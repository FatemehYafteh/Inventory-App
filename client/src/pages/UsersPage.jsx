import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PAGE_SIZE_OPTIONS } from '@/components/data-table/DataTablePagination';
import { FormAlert } from '@/components/form/FormAlert';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChangeRoleDialog } from '@/components/users/ChangeRoleDialog';
import { RejectUserDialog } from '@/components/users/RejectUserDialog';
import { UsersTable } from '@/components/users/UsersTable';
import { useMe } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';
import { useChangeRole, useChangeStatus, useUsers } from '@/lib/users';

const TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'rejected', label: 'Rejected' },
];
const DEFAULT_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 250;

function emptyMessage({ status, search, incomplete }) {
  if (search) return 'No users match your search.';
  if (status === 'pending') {
    return incomplete ? 'No unfinished signups.' : 'No one is waiting for approval.';
  }
  return status === 'active' ? 'No active users.' : 'No rejected users.';
}

/**
 * Admin: approve, reject and reactivate users and change their role. The tab, search,
 * "Incomplete profile" filter and page live in the URL.
 */
export function UsersPage() {
  const { data: me } = useMe();
  const [params, setParams] = useSearchParams();

  const status = TABS.some((tab) => tab.value === params.get('status'))
    ? params.get('status')
    : 'pending';
  const search = params.get('search') ?? '';
  const incomplete = status === 'pending' && params.get('incomplete') === 'true';
  const limit = PAGE_SIZE_OPTIONS.includes(Number(params.get('limit')))
    ? Number(params.get('limit'))
    : DEFAULT_PAGE_SIZE;
  const page = Math.max(Number(params.get('page')) || 1, 1);

  // Changing any filter goes back to the first page.
  const update = useCallback(
    (changes) => {
      setParams((previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries({ page: undefined, ...changes })) {
          if (value === undefined || value === '' || value === false) next.delete(key);
          else next.set(key, String(value));
        }
        return next;
      });
    },
    [setParams],
  );

  const [searchText, setSearchText] = useState(search);
  useEffect(() => {
    if (searchText === search) return undefined;
    const timer = setTimeout(() => update({ search: searchText.trim() }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText, search, update]);

  const users = useUsers({ status, search, incomplete, page, limit });
  const changeStatus = useChangeStatus();
  const changeRole = useChangeRole();
  const busy = changeStatus.isPending || changeRole.isPending;

  const [actionError, setActionError] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [changingRole, setChangingRole] = useState(null);

  const run = useCallback((mutation, variables) => {
    setActionError(null);
    mutation.mutate(variables, { onError: (error) => setActionError(errorMessage(error)) });
  }, []);

  const onApprove = useCallback(
    (user) => run(changeStatus, { id: user.id, status: 'active' }),
    [run, changeStatus],
  );
  const onReactivate = useCallback(
    (user, to) => run(changeStatus, { id: user.id, status: to }),
    [run, changeStatus],
  );
  const onReject = useCallback((user) => setRejecting(user), []);
  const onChangeRole = useCallback((user) => setChangingRole(user), []);

  const pagination = useMemo(() => ({ pageIndex: page - 1, pageSize: limit }), [page, limit]);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Users</h1>
      <FormAlert>{actionError}</FormAlert>

      <Tabs value={status} onValueChange={(value) => update({ status: value, incomplete: false })}>
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={status}>
          <UsersTable
            users={users.data?.items ?? []}
            total={users.data?.total ?? 0}
            meId={me?.id}
            busy={busy}
            pagination={pagination}
            onPaginationChange={(updater) => {
              const next = typeof updater === 'function' ? updater(pagination) : updater;
              update({
                page: next.pageIndex > 0 ? next.pageIndex + 1 : undefined,
                limit: next.pageSize === DEFAULT_PAGE_SIZE ? undefined : next.pageSize,
              });
            }}
            isLoading={users.isPending}
            error={users.error}
            emptyMessage={emptyMessage({ status, search, incomplete })}
            toolbar={
              <div className="flex flex-wrap items-center gap-4">
                <Input
                  type="search"
                  aria-label="Search users"
                  placeholder="Search name, email or Telegram"
                  className="max-w-xs"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                />
                {status === 'pending' && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={incomplete}
                      onChange={(event) => update({ incomplete: event.target.checked })}
                    />
                    Incomplete profile
                  </label>
                )}
              </div>
            }
            onApprove={onApprove}
            onReject={onReject}
            onReactivate={onReactivate}
            onChangeRole={onChangeRole}
          />
        </TabsContent>
      </Tabs>

      <RejectUserDialog
        key={rejecting?.id}
        user={rejecting}
        busy={busy}
        onCancel={() => setRejecting(null)}
        onConfirm={(user, reason) => {
          setRejecting(null);
          run(changeStatus, { id: user.id, status: 'rejected', ...(reason && { reason }) });
        }}
      />
      <ChangeRoleDialog
        user={changingRole}
        onCancel={() => setChangingRole(null)}
        onConfirm={(user, role) => {
          setChangingRole(null);
          run(changeRole, { id: user.id, role });
        }}
      />
    </section>
  );
}
