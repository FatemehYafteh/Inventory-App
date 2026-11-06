import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { productCountLabel } from '@/components/categories/CategoryCard';
import { DataTable } from '@/components/data-table/DataTable';
import { RowActionsMenu } from '@/components/data-table/RowActionsMenu';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import i18n from '@/i18n';
import { formatNumber } from '@/lib/format';

function movementCountLabel(count) {
  return i18n.t('suppliers.movementCount', { count, n: formatNumber(count) });
}

/** Why Delete is disabled: the same wording as the server's IN_USE message. */
export function inUseReason({ productCount, movementCount }) {
  const parts = [];
  if (productCount > 0) parts.push(productCountLabel(productCount));
  if (movementCount > 0) parts.push(movementCountLabel(movementCount));
  const usage =
    parts.length > 1
      ? i18n.t('suppliers.usageJoin', { first: parts[0], second: parts[1] })
      : parts.join('');
  return i18n.t('suppliers.inUseReason', { usage });
}

const dash = <span className="text-muted-foreground">—</span>;

const linkClass =
  'rounded-sm text-primary-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

// Emails and phone numbers read left to right in every language, isolated from the text around.
const ltr = '[unicode-bidi:isolate] [overflow-wrap:anywhere]';

function Actions({ supplier, busy, onEdit, onToggleActive, onDelete }) {
  const { t } = useTranslation();
  const inUse = supplier.productCount > 0 || supplier.movementCount > 0;
  const reasonId = `supplier-${supplier.id}-in-use`;
  const reason = inUse ? inUseReason(supplier) : undefined;
  const { name } = supplier;

  // Edit stays visible; Deactivate/Reactivate and Delete are in the "⋯" menu.
  const items = [
    {
      key: 'toggle',
      label: supplier.isActive ? t('suppliers.table.deactivate') : t('suppliers.table.reactivate'),
      ariaLabel: t(
        supplier.isActive ? 'suppliers.table.deactivateLabel' : 'suppliers.table.reactivateLabel',
        { name },
      ),
      disabled: busy,
      onSelect: () => onToggleActive(supplier),
    },
    {
      key: 'delete',
      label: t('suppliers.table.delete'),
      ariaLabel: t('suppliers.table.deleteLabel', { name }),
      describedBy: inUse ? reasonId : undefined,
      title: reason,
      destructive: true,
      disabled: busy || inUse,
      onSelect: () => onDelete(supplier),
    },
  ];

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        aria-label={t('suppliers.table.editLabel', { name })}
        disabled={busy}
        onClick={() => onEdit(supplier)}
      >
        {t('suppliers.table.edit')}
      </Button>
      <RowActionsMenu label={t('suppliers.table.moreActions', { name })} items={items} />
      {inUse && (
        <span id={reasonId} className="sr-only">
          {reason}
        </span>
      )}
    </div>
  );
}

/**
 * The suppliers table. The server searches, sorts and pages; `sorting` is [{ id, desc }] and
 * `pagination` is { pageIndex, pageSize }. Without `canManage` it is read-only.
 */
export function SupplierTable({
  suppliers,
  total,
  canManage,
  busy,
  sorting,
  onSortingChange,
  pagination,
  onPaginationChange,
  isLoading,
  error,
  emptyMessage,
  toolbar,
  onEdit,
  onToggleActive,
  onDelete,
}) {
  const { t } = useTranslation();
  const columns = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: t('suppliers.table.name'),
        cell: ({ row }) => (
          <span className="flex flex-wrap items-center gap-2 font-medium">
            <Link
              to={`/products?supplier=${encodeURIComponent(row.original.id)}`}
              className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <bdi>{row.original.name}</bdi>
            </Link>
            {!row.original.isActive && <StatusBadge status="inactive" />}
          </span>
        ),
      },
      {
        id: 'contactPerson',
        header: t('suppliers.table.contactPerson'),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.contactPerson ? <bdi>{row.original.contactPerson}</bdi> : dash,
      },
      {
        id: 'phone',
        header: t('suppliers.table.phone'),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.phone ? (
            <a
              href={`tel:${row.original.phone.replace(/[^\d+]/g, '')}`}
              dir="ltr"
              className={`${linkClass} ${ltr}`}
            >
              {row.original.phone}
            </a>
          ) : (
            dash
          ),
      },
      {
        id: 'email',
        header: t('suppliers.table.email'),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.email ? (
            <a href={`mailto:${row.original.email}`} dir="ltr" className={`${linkClass} ${ltr}`}>
              {row.original.email}
            </a>
          ) : (
            dash
          ),
      },
      {
        id: 'productCount',
        header: t('suppliers.table.productCount'),
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            to={`/products?supplier=${encodeURIComponent(row.original.id)}`}
            className={`${linkClass} tabular-nums`}
          >
            {formatNumber(row.original.productCount)}
          </Link>
        ),
      },
      ...(canManage
        ? [
            {
              id: 'actions',
              header: t('suppliers.table.actions'),
              enableSorting: false,
              cell: ({ row }) => (
                <Actions
                  supplier={row.original}
                  busy={busy}
                  onEdit={onEdit}
                  onToggleActive={onToggleActive}
                  onDelete={onDelete}
                />
              ),
            },
          ]
        : []),
    ],
    [t, canManage, busy, onEdit, onToggleActive, onDelete],
  );

  return (
    <DataTable
      columns={columns}
      data={suppliers}
      rowCount={total}
      sorting={sorting}
      onSortingChange={onSortingChange}
      pagination={pagination}
      onPaginationChange={onPaginationChange}
      isLoading={isLoading}
      error={error}
      emptyMessage={emptyMessage}
      toolbar={toolbar}
    />
  );
}
