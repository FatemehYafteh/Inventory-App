import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/data-table/DataTable';
import { MovementCard } from '@/components/movements/MovementCard';
import { MovementTypeBadge } from '@/components/movements/MovementTypeBadge';
import { movementNote } from '@/components/movements/movementNote';
import { signedChange as signed } from '@/components/movements/signedChange';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, formatNumber } from '@/lib/format';

const NO_SORTING = [];
const noSortChange = () => {};

const dash = <span className="text-muted-foreground">—</span>;
const wrap = '[overflow-wrap:anywhere]';

function buildColumns(t) {
  const column = (id, cell) => ({
    id,
    header: t(`movements.columns.${id}`),
    enableSorting: false,
    cell,
  });
  const quantity = (id) =>
    column(id, ({ row }) => <span className="tabular-nums">{formatNumber(row.original[id])}</span>);

  return [
    column('createdAt', ({ row }) => (
      <span className="whitespace-nowrap">{formatDateTime(row.original.createdAt)}</span>
    )),
    column('product', ({ row }) => {
      const { product } = row.original;
      return product ? (
        <div className={`flex flex-col ${wrap}`}>
          <span className="font-medium">
            <bdi>{product.title}</bdi>
          </span>
          <span className="text-xs text-muted-foreground">
            <bdi>{product.sku}</bdi>
          </span>
        </div>
      ) : (
        dash
      );
    }),
    column('type', ({ row }) => <MovementTypeBadge type={row.original.type} />),
    column('quantityChange', ({ row }) => (
      <span className="tabular-nums">{signed(t, row.original.quantityChange)}</span>
    )),
    quantity('quantityBefore'),
    quantity('quantityAfter'),
    column('supplier', ({ row }) =>
      row.original.supplier ? (
        <span className={wrap}>
          <bdi>{row.original.supplier.name}</bdi>
        </span>
      ) : (
        dash
      ),
    ),
    column('note', ({ row }) => {
      const note = movementNote(t, row.original);
      return note ? (
        <span className={wrap}>
          <bdi>{note}</bdi>
        </span>
      ) : (
        dash
      );
    }),
    column('performedBy', ({ row }) => {
      const { name, role } = row.original.performedBy;
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span className={wrap}>
            <bdi>{name}</bdi>
          </span>
          {role && <Badge variant="secondary">{t(`users.role.${role}`)}</Badge>}
        </div>
      );
    }),
  ];
}

/** All stock movements, newest first. The server filters and pages; this only renders. */
export function MovementTable({
  movements,
  total,
  pagination,
  onPaginationChange,
  isLoading,
  error,
  onRetry,
  emptyMessage,
  toolbar,
}) {
  const { t } = useTranslation();
  const columns = useMemo(() => buildColumns(t), [t]);
  return (
    <DataTable
      columns={columns}
      data={movements}
      rowCount={total}
      sorting={NO_SORTING}
      onSortingChange={noSortChange}
      pagination={pagination}
      onPaginationChange={onPaginationChange}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyMessage={emptyMessage}
      toolbar={toolbar}
      renderCard={(movement) => <MovementCard movement={movement} />}
    />
  );
}
