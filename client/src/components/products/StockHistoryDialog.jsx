import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TBdi } from '@/components/BidiText';
import { DataTable } from '@/components/data-table/DataTable';
import { MovementTypeBadge } from '@/components/movements/MovementTypeBadge';
import { movementNote } from '@/components/movements/movementNote';
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
      cell: ({ row }) => <MovementTypeBadge type={row.original.type} />,
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
      id: 'quantityBeforeAfter',
      header: t('products.history.beforeAfter'),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="whitespace-nowrap tabular-nums">
          {t('products.history.beforeAfterValue', {
            before: formatNumber(row.original.quantityBefore),
            after: formatNumber(row.original.quantityAfter),
          })}
        </span>
      ),
    },
    {
      id: 'note',
      header: t('products.history.note'),
      enableSorting: false,
      // The supplier of a receive sits under the note, so it needs no column of its own.
      cell: ({ row }) => {
        const note = movementNote(t, row.original);
        const { supplier } = row.original;
        if (!note && !supplier) return dash;
        return (
          <div className="flex min-w-32 flex-col gap-0.5 [overflow-wrap:anywhere]">
            {note && (
              <span>
                <bdi>{note}</bdi>
              </span>
            )}
            {supplier && (
              <span className="text-xs text-muted-foreground">
                <bdi>{supplier.name}</bdi>
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: 'performedBy',
      header: t('products.history.performedBy'),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="[overflow-wrap:anywhere]">
          <bdi>{row.original.performedBy.name}</bdi>
        </span>
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
            <TBdi
              i18nKey="products.history.description"
              values={{ title: product.title, sku: product.sku }}
            />
          </DialogDescription>
        </DialogHeader>
        {/* min-w-0 lets the table scroll inside the dialog instead of widening it. */}
        <div className="min-w-0">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
