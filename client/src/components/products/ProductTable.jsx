import { Minus, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/data-table/DataTable';
import { renderCell } from '@/components/data-table/renderCell';
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
  onRetry,
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
          // 40px targets on touch screens (cards, below lg), 32px in the desktop table.
          return (
            <div className="flex items-center gap-3 lg:gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-10 w-10 px-0 lg:h-8 lg:w-8"
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
                className="h-10 w-10 px-0 lg:h-8 lg:w-8"
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

  // Below md each product is a card that reuses the table's own cells, so behaviour is shared.
  const renderCard = (product) => {
    const cell = (id) => renderCell(columns, id, product);
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-medium [overflow-wrap:anywhere]">
              <bdi>{product.title}</bdi>
            </span>
            <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
              <bdi>{product.sku}</bdi>
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            {cell('stockStatus')}
            {product.isArchived && <StatusBadge status="archived" />}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-muted-foreground">{t('products.table.quantity')}</dt>
            <dd>{cell('quantity')}</dd>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-muted-foreground">{t('products.table.price')}</dt>
            <dd>{cell('price')}</dd>
          </div>
          <div className="col-span-2 flex min-w-0 flex-col gap-0.5">
            <dt className="text-muted-foreground">{t('products.table.category')}</dt>
            <dd>{cell('category')}</dd>
          </div>
        </dl>
        {cell('actions')}
      </div>
    );
  };

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
      onRetry={onRetry}
      emptyMessage={emptyMessage}
      toolbar={toolbar}
      renderCard={renderCard}
    />
  );
}
