import { Minus, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/data-table/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { formatDate, formatNumber, formatPrice } from '@/lib/format';

const dash = <span className="text-muted-foreground">—</span>;

/**
 * The products table. The server searches, filters, sorts and pages; `sorting` is [{ id, desc }]
 * and `pagination` is { pageIndex, pageSize }. Title, Quantity and Price sort. Archive and
 * Restore show only when `canArchive` (admins). The - and + beside the quantity call
 * `onStep(product, -1 or 1)`; they are off for archived products, and - is off at 0. Adjust stock
 * calls `onAdjust(product)` and is off for archived products too. History calls `onHistory(product)`.
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
  onAdjust,
  onHistory,
  canArchive,
  onArchive,
  onRestore,
}) {
  const { t } = useTranslation();
  const columns = useMemo(
    () => [
      {
        accessorKey: 'title',
        header: t('products.table.title'),
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
              header: t('products.table.archived'),
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
        header: t('products.table.category'),
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
        header: t('products.table.supplier'),
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
        header: t('products.table.price'),
        cell: ({ row }) => <span className="tabular-nums">{formatPrice(row.original.price)}</span>,
      },
      {
        accessorKey: 'quantity',
        sortDescFirst: false,
        header: t('products.table.quantity'),
        cell: ({ row }) => {
          const { title, quantity, isArchived } = row.original;
          return (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="w-8 px-0"
                aria-label={t('products.table.decreaseQuantity', { title })}
                disabled={isArchived || quantity <= 0}
                onClick={() => onStep(row.original, -1)}
              >
                <Minus aria-hidden="true" />
              </Button>
              <span className="min-w-8 text-center tabular-nums">{formatNumber(quantity)}</span>
              <Button
                variant="outline"
                size="sm"
                className="w-8 px-0"
                aria-label={t('products.table.increaseQuantity', { title })}
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
        header: t('products.table.stockStatus'),
        enableSorting: false,
        cell: ({ row }) => <StatusBadge status={row.original.stockStatus} />,
      },
      {
        id: 'createdAt',
        header: t('products.table.created'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{formatDate(row.original.createdAt)}</span>
        ),
      },
      {
        id: 'actions',
        header: t('products.table.actions'),
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              aria-label={t('products.table.adjustStockOf', { title: row.original.title })}
              disabled={row.original.isArchived}
              onClick={() => onAdjust(row.original)}
            >
              {t('products.table.adjustStock')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-label={t('products.table.historyOf', { title: row.original.title })}
              onClick={() => onHistory(row.original)}
            >
              {t('products.table.history')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-label={t('products.table.editOf', { title: row.original.title })}
              onClick={() => onEdit(row.original)}
            >
              {t('products.table.edit')}
            </Button>
            {canArchive && (
              <Button
                variant="outline"
                size="sm"
                aria-label={t(
                  row.original.isArchived ? 'products.table.restoreOf' : 'products.table.archiveOf',
                  { title: row.original.title },
                )}
                onClick={() =>
                  row.original.isArchived ? onRestore(row.original) : onArchive(row.original)
                }
              >
                {row.original.isArchived
                  ? t('products.table.restore')
                  : t('products.table.archive')}
              </Button>
            )}
          </div>
        ),
      },
    ],
    [t, onEdit, onStep, onAdjust, onHistory, canArchive, onArchive, onRestore],
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
