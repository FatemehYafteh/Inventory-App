import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/data-table/DataTable';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDateTime, formatNumber } from '@/lib/format';
import { useMovements } from '@/lib/products';

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const NO_SORTING = [];

const dash = <span className="text-muted-foreground">—</span>;

/** A signed change as text, so the direction never depends on colour: +5, −2. */
function signed(t, change) {
  return change > 0
    ? t('products.history.plus', { n: formatNumber(change) })
    : t('products.history.minus', { n: formatNumber(Math.abs(change)) });
}

function buildColumns(t) {
  return [
    {
      id: 'createdAt',
      header: t('products.history.date'),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="whitespace-nowrap">{formatDateTime(row.original.createdAt)}</span>
      ),
    },
    {
      id: 'type',
      header: t('products.history.type'),
      enableSorting: false,
      cell: ({ row }) => t(`products.history.types.${row.original.type}`),
    },
    {
      id: 'quantityChange',
      header: t('products.history.change'),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="tabular-nums">{signed(t, row.original.quantityChange)}</span>
      ),
    },
    {
      id: 'quantityBefore',
      header: t('products.history.before'),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="tabular-nums">{formatNumber(row.original.quantityBefore)}</span>
      ),
    },
    {
      id: 'quantityAfter',
      header: t('products.history.after'),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="tabular-nums">{formatNumber(row.original.quantityAfter)}</span>
      ),
    },
    {
      id: 'supplier',
      header: t('products.history.supplier'),
      enableSorting: false,
      cell: ({ row }) =>
        row.original.supplier ? (
          <span className="[overflow-wrap:anywhere]">{row.original.supplier.name}</span>
        ) : (
          dash
        ),
    },
    {
      id: 'note',
      header: t('products.history.note'),
      enableSorting: false,
      cell: ({ row }) =>
        row.original.note ? (
          <span className="[overflow-wrap:anywhere]">{row.original.note}</span>
        ) : (
          dash
        ),
    },
    {
      id: 'performedBy',
      header: t('products.history.performedBy'),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="[overflow-wrap:anywhere]">{row.original.performedBy.name}</span>
      ),
    },
  ];
}

/** A product's stock movements, newest first, a page at a time. */
export function StockHistoryDialog({ product, onClose, onCloseAutoFocus }) {
  const { t } = useTranslation();
  const columns = useMemo(() => buildColumns(t), [t]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const movements = useMovements(product.id, {
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
  });
  const items = useMemo(() => movements.data?.items ?? [], [movements.data]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{t('products.history.title')}</DialogTitle>
          <DialogDescription className="[overflow-wrap:anywhere]">
            {t('products.history.description', { title: product.title, sku: product.sku })}
          </DialogDescription>
        </DialogHeader>
        <DataTable
          columns={columns}
          data={items}
          rowCount={movements.data?.total ?? 0}
          sorting={NO_SORTING}
          onSortingChange={() => {}}
          pagination={pagination}
          onPaginationChange={setPagination}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          isLoading={movements.isPending}
          error={movements.error}
          emptyMessage={t('products.history.empty')}
        />
      </DialogContent>
    </Dialog>
  );
}
