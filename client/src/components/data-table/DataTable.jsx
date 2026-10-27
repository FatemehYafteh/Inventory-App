import { useTranslation } from 'react-i18next';
import {
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/data-table/DataTableColumnHeader';
import { DataTablePagination } from '@/components/data-table/DataTablePagination';
import { FormAlert } from '@/components/form/FormAlert';
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

/**
 * Server-driven table. The caller owns `sorting` and `pagination` (kept in the URL), fetches the
 * matching page with TanStack Query, and passes that page as `data` with the total as `rowCount`.
 * Keep `columns` and `data` stable (module scope or useMemo), or the table rebuilds every render.
 *
 * - sorting: [{ id, desc }], pagination: { pageIndex (0-based), pageSize }
 * - toolbar: optional search and filter controls shown above the table
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
}) {
  const { t } = useTranslation();
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

  let status = null;
  if (isLoading) status = <span role="status">{t('common.loading')}</span>;
  else if (!rows.length) status = emptyMessage ?? t('table.empty');

  return (
    <div className="flex flex-col gap-3">
      {toolbar}
      {error && (
        <FormAlert>{translateMessage(error.message) ?? t('common.somethingWrong')}</FormAlert>
      )}
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
            {status ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-24 text-center text-muted-foreground">
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
      <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />
    </div>
  );
}
