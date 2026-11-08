import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import {
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/data-table/DataTableColumnHeader';
import { DataTablePagination } from '@/components/data-table/DataTablePagination';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/form/FormAlert';
import { useIsCompact } from '@/hooks/useMediaQuery';
import { translateMessage } from '@/lib/errors';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// The server sorts and paginates; the table only renders the page it is given.
const features = tableFeatures({ rowSortingFeature, rowPaginationFeature });
const ARIA_SORT = { asc: 'ascending', desc: 'descending' };

/** Below `md` the cards have no column headers to click, so sorting moves into this select. */
function MobileSort({ table, sorting }) {
  const { t } = useTranslation();
  const id = useId();
  const sortable = table.getAllLeafColumns().filter((column) => column.getCanSort());
  if (sortable.length === 0) return null;
  const current = sorting[0];
  const options = sortable.flatMap((column) =>
    ['asc', 'desc'].map((direction) => ({
      value: `${column.id}:${direction}`,
      label: t(direction === 'asc' ? 'table.sortAsc' : 'table.sortDesc', {
        column: column.columnDef.header,
      }),
    })),
  );
  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor={id} className="shrink-0 text-muted-foreground">
        {t('table.sortBy')}
      </label>
      <select
        id={id}
        value={current ? `${current.id}:${current.desc ? 'desc' : 'asc'}` : ''}
        onChange={(event) => {
          const [column, direction] = event.target.value.split(':');
          table.setSorting([{ id: column, desc: direction === 'desc' }]);
        }}
        className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {!current && <option value="" disabled />}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const SKELETON_ROWS = ['s1', 's2', 's3', 's4', 's5'];
const SKELETON_CARDS = ['c1', 'c2', 'c3'];

/** A grey placeholder bar while a list loads. Still for people who ask for reduced motion. */
function Skeleton({ className = 'w-full' }) {
  return (
    <div className={`h-4 animate-pulse rounded bg-muted motion-reduce:animate-none ${className}`} />
  );
}

/**
 * Server-driven table. The caller owns `sorting` and `pagination` (kept in the URL), fetches the
 * matching page with TanStack Query, and passes that page as `data` with the total as `rowCount`.
 * Keep `columns` and `data` stable (module scope or useMemo), or the table rebuilds every render.
 *
 * - sorting: [{ id, desc }], pagination: { pageIndex (0-based), pageSize }
 * - toolbar: optional search and filter controls shown above the table
 * - renderCard: optional `(rowData) => node`. Below `md` each row is then a card made by it,
 *   instead of a horizontally scrolling table (with a "Sort by" select where columns sort)
 */
export function DataTable({
  columns,
  data,
  rowCount,
  sorting,
  onSortingChange,
  pagination,
  onPaginationChange,
  isLoading = false,
  error = null,
  emptyMessage,
  toolbar = null,
  pageSizeOptions,
  renderCard,
  onRetry,
}) {
  const { t } = useTranslation();
  const showCards = useIsCompact() && Boolean(renderCard);
  const table = useTable({
    features,
    columns,
    data,
    rowCount,
    state: { sorting, pagination },
    onSortingChange,
    onPaginationChange,
    manualSorting: true,
    manualPagination: true,
  });

  const rows = table.getRowModel().rows;
  const columnCount = table.getAllLeafColumns().length;

  // While loading: placeholder rows (or cards) for the layout, and one status message for
  // screen readers. Otherwise the empty message when there are no rows.
  const status = !isLoading && !rows.length ? (emptyMessage ?? t('table.empty')) : null;

  return (
    <div className="flex flex-col gap-3">
      {isLoading && (
        <span role="status" className="sr-only">
          {t('common.loading')}
        </span>
      )}
      {toolbar}
      {error && (
        <div className="flex flex-col gap-2">
          <FormAlert>{translateMessage(error.message) ?? t('common.somethingWrong')}</FormAlert>
          {onRetry && (
            <Button variant="outline" size="sm" className="self-start" onClick={onRetry}>
              {t('common.tryAgain')}
            </Button>
          )}
        </div>
      )}
      {showCards ? (
        <div className="flex flex-col gap-3">
          <MobileSort table={table} sorting={sorting} />
          {isLoading ? (
            <ul aria-hidden="true" className="grid gap-3 md:grid-cols-2">
              {SKELETON_CARDS.map((key) => (
                <li key={key} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
                  <Skeleton className="w-2/3" />
                  <Skeleton className="w-1/3" />
                  <Skeleton className="w-1/2" />
                </li>
              ))}
            </ul>
          ) : status ? (
            <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
              {status}
            </div>
          ) : (
            <ul aria-busy={isLoading} className="grid gap-3 md:grid-cols-2">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="min-w-0 rounded-lg border bg-card p-4 text-card-foreground shadow-xs"
                >
                  {renderCard(row.original)}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table aria-busy={isLoading}>
            <TableHeader>
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      aria-sort={ARIA_SORT[header.column.getIsSorted()]}
                    >
                      {header.isPlaceholder ? null : (
                        <DataTableColumnHeader header={header}>
                          <table.FlexRender header={header} />
                        </DataTableColumnHeader>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                SKELETON_ROWS.map((key) => (
                  <TableRow key={key} data-static aria-hidden="true">
                    {table.getAllLeafColumns().map((column) => (
                      <TableCell key={column.id}>
                        <Skeleton />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : status ? (
                <TableRow data-static>
                  <TableCell
                    colSpan={columnCount}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {status}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getAllCells().map((cell) => (
                      <TableCell key={cell.id}>
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
      <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />
    </div>
  );
}
