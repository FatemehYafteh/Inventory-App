import { Minus, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/data-table/DataTable';
import { RowActionsMenu } from '@/components/data-table/RowActionsMenu';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { formatNumber, formatPrice } from '@/lib/format';

const dash = <span className="text-muted-foreground">—</span>;

/**
 * The products table. The server searches, filters, sorts and pages; `sorting` is [{ id, desc }]
 * and `pagination` is { pageIndex, pageSize }. Title, Quantity and Price sort. History, Edit and Archive/Restore sit in the row's "⋯" menu; Archive and
 * Restore show only when `canArchive` (admins). The - and + beside the quantity call
 * `onStep(product, -1 or 1)`; the Archived column shows only with `showArchived` (admins who chose to include
 * archived products), since otherwise it would be empty; they are off for archived products, and - is off at 0. Adjust stock
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
  showArchived,
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
            <span className="font-medium [overflow-wrap:anywhere]">
              <bdi>{row.original.title}</bdi>
            </span>
            <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
              <bdi>{row.original.sku}</bdi>
            </span>
          </div>
        ),
      },
      // Only when archived products are included (admins; staff never see them): without them the
      // column would be empty. Fixed width, so the badge appearing or disappearing moves nothing
      // in the Title cell.
      ...(canArchive && showArchived
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
            <span className="[overflow-wrap:anywhere]">
              <bdi>{row.original.category.title}</bdi>
            </span>
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
            <span className="[overflow-wrap:anywhere]">
              <bdi>{row.original.supplier.name}</bdi>
            </span>
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
        id: 'actions',
        header: t('products.table.actions'),
        enableSorting: false,
        cell: ({ row }) => {
          const product = row.original;
          const { title } = product;
          // Adjust stock stays visible; the rest live in the menu. Staff never get Archive.
          const items = [
            {
              key: 'history',
              label: t('products.table.history'),
              ariaLabel: t('products.table.historyOf', { title }),
              onSelect: () => onHistory(product),
            },
            {
              key: 'edit',
              label: t('products.table.edit'),
              ariaLabel: t('products.table.editOf', { title }),
              onSelect: () => onEdit(product),
            },
            ...(canArchive
              ? [
                  {
                    key: 'archive',
                    label: product.isArchived
                      ? t('products.table.restore')
                      : t('products.table.archive'),
                    ariaLabel: t(
                      product.isArchived ? 'products.table.restoreOf' : 'products.table.archiveOf',
                      { title },
                    ),
                    onSelect: () => (product.isArchived ? onRestore(product) : onArchive(product)),
                  },
                ]
              : []),
          ];
          return (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                aria-label={t('products.table.adjustStockOf', { title })}
                disabled={product.isArchived}
                onClick={() => onAdjust(product)}
              >
                {t('products.table.adjustStock')}
              </Button>
              <RowActionsMenu label={t('products.table.moreActions', { title })} items={items} />
            </div>
          );
        },
      },
    ],
    [t, onEdit, onStep, onAdjust, onHistory, canArchive, showArchived, onArchive, onRestore],
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
