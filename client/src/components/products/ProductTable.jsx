import { Minus, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { DataTable } from '@/components/data-table/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { formatDate, formatPrice } from '@/lib/format';

const dash = <span className="text-muted-foreground">—</span>;

/**
 * The products table. The server searches, filters, sorts and pages; `sorting` is [{ id, desc }]
 * and `pagination` is { pageIndex, pageSize }. Title, Quantity and Price sort. Archive and
 * Restore show only when `canArchive` (admins). The - and + beside the quantity call
 * `onStep(product, -1 or 1)`; they are off for archived products, and - is off at 0.
 */
export function ProductTable({
  products,
  total,
  sorting,
  onSortingChange,
  pagination,
  onPaginationChange,
  isLoading,
  error,
  emptyMessage,
  toolbar,
  onEdit,
  onStep,
  canArchive,
  onArchive,
  onRestore,
}) {
  const columns = useMemo(
    () => [
      {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ row }) => (
          <div className="flex min-w-48 flex-col gap-0.5">
            <span className="font-medium [overflow-wrap:anywhere]">{row.original.title}</span>
            <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
              {row.original.sku}
            </span>
          </div>
        ),
      },
      // Admins only (staff never see archived products). The column is always there, at a fixed
      // width, so the badge appearing or disappearing moves nothing in the Title cell.
      ...(canArchive
        ? [
            {
              id: 'archived',
              header: 'Archived',
              enableSorting: false,
              cell: ({ row }) => (
                <div className="w-[4.5rem]">
                  {row.original.isArchived && <StatusBadge status="archived" />}
                </div>
              ),
            },
          ]
        : []),
      {
        id: 'category',
        header: 'Category',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.category ? (
            <span className="[overflow-wrap:anywhere]">{row.original.category.title}</span>
          ) : (
            dash
          ),
      },
      {
        id: 'supplier',
        header: 'Supplier',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.supplier ? (
            <span className="[overflow-wrap:anywhere]">{row.original.supplier.name}</span>
          ) : (
            dash
          ),
      },
      {
        accessorKey: 'price',
        sortDescFirst: false,
        header: 'Price',
        cell: ({ row }) => <span className="tabular-nums">{formatPrice(row.original.price)}</span>,
      },
      {
        accessorKey: 'quantity',
        sortDescFirst: false,
        header: 'Quantity',
        cell: ({ row }) => {
          const { title, quantity, isArchived } = row.original;
          return (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="w-8 px-0"
                aria-label={`Decrease quantity of ${title}`}
                disabled={isArchived || quantity <= 0}
                onClick={() => onStep(row.original, -1)}
              >
                <Minus aria-hidden="true" />
              </Button>
              <span className="min-w-8 text-center tabular-nums">{quantity}</span>
              <Button
                variant="outline"
                size="sm"
                className="w-8 px-0"
                aria-label={`Increase quantity of ${title}`}
                disabled={isArchived}
                onClick={() => onStep(row.original, 1)}
              >
                <Plus aria-hidden="true" />
              </Button>
            </div>
          );
        },
      },
      {
        id: 'stockStatus',
        header: 'Stock status',
        enableSorting: false,
        cell: ({ row }) => <StatusBadge status={row.original.stockStatus} />,
      },
      {
        id: 'createdAt',
        header: 'Created',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{formatDate(row.original.createdAt)}</span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              aria-label={`Edit ${row.original.title}`}
              onClick={() => onEdit(row.original)}
            >
              Edit
            </Button>
            {canArchive && (
              <Button
                variant="outline"
                size="sm"
                aria-label={`${row.original.isArchived ? 'Restore' : 'Archive'} ${row.original.title}`}
                onClick={() =>
                  row.original.isArchived ? onRestore(row.original) : onArchive(row.original)
                }
              >
                {row.original.isArchived ? 'Restore' : 'Archive'}
              </Button>
            )}
          </div>
        ),
      },
    ],
    [onEdit, onStep, canArchive, onArchive, onRestore],
  );

  return (
    <DataTable
      columns={columns}
      data={products}
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
