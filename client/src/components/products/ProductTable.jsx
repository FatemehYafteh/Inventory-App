import { useMemo } from 'react';
import { DataTable } from '@/components/data-table/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate, formatPrice } from '@/lib/format';

const dash = <span className="text-muted-foreground">—</span>;

/**
 * The products table. The server searches, filters, sorts and pages; `sorting` is [{ id, desc }]
 * and `pagination` is { pageIndex, pageSize }. Title, Quantity and Price sort. Read-only: the
 * Add, Edit, Archive and stock actions arrive in later phases.
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
}) {
  const columns = useMemo(
    () => [
      {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ row }) => (
          <div className="flex min-w-48 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2 font-medium [overflow-wrap:anywhere]">
              {row.original.title}
              {row.original.isArchived && <StatusBadge status="archived" />}
            </span>
            <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
              {row.original.sku}
            </span>
          </div>
        ),
      },
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
        cell: ({ row }) => <span className="tabular-nums">{row.original.quantity}</span>,
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
    ],
    [],
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
