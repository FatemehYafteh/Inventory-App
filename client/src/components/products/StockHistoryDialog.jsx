import { useMemo, useState } from 'react';
import { DataTable } from '@/components/data-table/DataTable';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDateTime } from '@/lib/format';
import { useMovements } from '@/lib/products';

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const NO_SORTING = [];

const TYPE_LABELS = {
  receive: 'Receive',
  ship: 'Ship',
  adjust: 'Adjust',
  increment: 'Increment',
  decrement: 'Decrement',
};

const dash = <span className="text-muted-foreground">—</span>;

/** A signed change as text, so the direction never depends on colour: +5, −2. */
function signed(change) {
  return change > 0 ? `+${change}` : `−${Math.abs(change)}`;
}

const columns = [
  {
    id: 'createdAt',
    header: 'Date',
    enableSorting: false,
    cell: ({ row }) => (
      <span className="whitespace-nowrap">{formatDateTime(row.original.createdAt)}</span>
    ),
  },
  {
    id: 'type',
    header: 'Type',
    enableSorting: false,
    cell: ({ row }) => TYPE_LABELS[row.original.type],
  },
  {
    id: 'quantityChange',
    header: 'Change',
    enableSorting: false,
    cell: ({ row }) => <span className="tabular-nums">{signed(row.original.quantityChange)}</span>,
  },
  {
    id: 'quantityBefore',
    header: 'Before',
    enableSorting: false,
    cell: ({ row }) => <span className="tabular-nums">{row.original.quantityBefore}</span>,
  },
  {
    id: 'quantityAfter',
    header: 'After',
    enableSorting: false,
    cell: ({ row }) => <span className="tabular-nums">{row.original.quantityAfter}</span>,
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
    id: 'note',
    header: 'Note',
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
    header: 'Performed by',
    enableSorting: false,
    cell: ({ row }) => (
      <span className="[overflow-wrap:anywhere]">{row.original.performedBy.name}</span>
    ),
  },
];

/** A product's stock movements, newest first, a page at a time. */
export function StockHistoryDialog({ product, onClose, onCloseAutoFocus }) {
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
          <DialogTitle>Stock history</DialogTitle>
          <DialogDescription className="[overflow-wrap:anywhere]">
            {product.title} ({product.sku}), newest first.
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
          emptyMessage="No stock changes yet."
        />
      </DialogContent>
    </Dialog>
  );
}
