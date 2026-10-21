import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/data-table/DataTable';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, formatNumber } from '@/lib/format';

const NO_SORTING = [];
const noSortChange = () => {};

const dash = <span className="text-muted-foreground">—</span>;
const wrap = '[overflow-wrap:anywhere]';

/** A signed change as text, so the direction never depends on colour: +5, −2. */
function signed(t, change) {
  return change > 0
    ? t('movements.plus', { n: formatNumber(change) })
    : t('movements.minus', { n: formatNumber(Math.abs(change)) });
}

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
          <span className="font-medium">{product.title}</span>
          <span className="text-xs text-muted-foreground">{product.sku}</span>
        </div>
      ) : (
        dash
      );
    }),
    column('type', ({ row }) => t(`movements.types.${row.original.type}`)),
    column('quantityChange', ({ row }) => (
      <span className="tabular-nums">{signed(t, row.original.quantityChange)}</span>
    )),
    quantity('quantityBefore'),
    quantity('quantityAfter'),
    column('supplier', ({ row }) =>
      row.original.supplier ? <span className={wrap}>{row.original.supplier.name}</span> : dash,
    ),
    column('note', ({ row }) =>
      row.original.note ? <span className={wrap}>{row.original.note}</span> : dash,
    ),
    column('performedBy', ({ row }) => {
      const { name, role } = row.original.performedBy;
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span className={wrap}>{name}</span>
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
      emptyMessage={emptyMessage}
      toolbar={toolbar}
    />
  );
}
