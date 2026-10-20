import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { productCountLabel } from '@/components/categories/CategoryCard';
import { DataTable } from '@/components/data-table/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';

function movementCountLabel(count) {
  return `${count} stock ${count === 1 ? 'movement' : 'movements'}`;
}

/** Why Delete is disabled: the same wording as the server's IN_USE message. */
export function inUseReason({ productCount, movementCount }) {
  const parts = [];
  if (productCount > 0) parts.push(productCountLabel(productCount));
  if (movementCount > 0) parts.push(movementCountLabel(movementCount));
  return `Used by ${parts.join(' and ')}. Deactivate it instead.`;
}

const dash = <span className="text-muted-foreground">—</span>;

function Actions({ supplier, busy, onEdit, onToggleActive, onDelete }) {
  const inUse = supplier.productCount > 0 || supplier.movementCount > 0;
  const reasonId = `supplier-${supplier.id}-in-use`;
  const reason = inUse ? inUseReason(supplier) : undefined;

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        aria-label={`Edit ${supplier.name}`}
        disabled={busy}
        onClick={() => onEdit(supplier)}
      >
        Edit
      </Button>
      <Button
        variant="outline"
        size="sm"
        aria-label={`${supplier.isActive ? 'Deactivate' : 'Reactivate'} ${supplier.name}`}
        disabled={busy}
        onClick={() => onToggleActive(supplier)}
      >
        {supplier.isActive ? 'Deactivate' : 'Reactivate'}
      </Button>
      {/* A disabled button gets no hover events, so the span carries the tooltip. */}
      <span title={reason}>
        <Button
          variant="outline"
          size="sm"
          aria-label={`Delete ${supplier.name}`}
          aria-describedby={inUse ? reasonId : undefined}
          disabled={busy || inUse}
          onClick={() => onDelete(supplier)}
        >
          Delete
        </Button>
      </span>
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
  const columns = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <span className="flex flex-wrap items-center gap-2 font-medium">
            <Link
              to={`/products?supplier=${encodeURIComponent(row.original.id)}`}
              className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {row.original.name}
            </Link>
            {!row.original.isActive && <StatusBadge status="inactive" />}
          </span>
        ),
      },
      {
        id: 'contactPerson',
        header: 'Contact person',
        enableSorting: false,
        cell: ({ row }) => row.original.contactPerson || dash,
      },
      {
        id: 'phone',
        header: 'Phone',
        enableSorting: false,
        cell: ({ row }) => row.original.phone || dash,
      },
      {
        id: 'email',
        header: 'Email',
        enableSorting: false,
        cell: ({ row }) => row.original.email || dash,
      },
      {
        id: 'productCount',
        header: 'Product count',
        enableSorting: false,
        cell: ({ row }) => row.original.productCount,
      },
      ...(canManage
        ? [
            {
              id: 'actions',
              header: 'Actions',
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
    [canManage, busy, onEdit, onToggleActive, onDelete],
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
