import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/format';

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/** Previous / next controls, page position, total and page size for a server-paginated table. */
export function DataTablePagination({ table, pageSizeOptions = PAGE_SIZE_OPTIONS }) {
  const { t } = useTranslation();
  const pageSizeId = useId();
  const { pageIndex, pageSize } = table.state.pagination;
  const rowCount = table.getRowCount();
  const pageCount = Math.max(table.getPageCount(), 1);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">
        {t('table.results', { count: rowCount, n: formatNumber(rowCount) })}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor={pageSizeId} className="text-muted-foreground">
            {t('table.rowsPerPage')}
          </label>
          <select
            id={pageSizeId}
            value={pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="h-8 rounded-md border bg-background px-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {formatNumber(size)}
              </option>
            ))}
          </select>
        </div>
        <p aria-live="polite">
          {t('table.pageOf', {
            page: formatNumber(pageIndex + 1),
            total: formatNumber(pageCount),
          })}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            {t('table.previous')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            {t('table.next')}
          </Button>
        </div>
      </div>
    </div>
  );
}
