import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/format';

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/**
 * Previous / next controls, page position, total and page size for a server-paginated table.
 * When everything fits on one page only the count is shown. Below `md` it is compact: the count,
 * then Previous / page x of y / Next on one row (rows per page is hidden there).
 */
export function DataTablePagination({ table, pageSizeOptions = PAGE_SIZE_OPTIONS }) {
  const { t } = useTranslation();
  const pageSizeId = useId();
  const { pageIndex, pageSize } = table.state.pagination;
  const rowCount = table.getRowCount();
  const pageCount = Math.max(table.getPageCount(), 1);
  // Everything fits on one page: the count is enough, the paging controls would do nothing.
  const fitsOnePage = pageCount <= 1 && pageIndex === 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">
        {t('table.results', { count: rowCount, n: formatNumber(rowCount) })}
      </p>
      {!fitsOnePage && (
        <div className="flex w-full items-center justify-between gap-2 md:w-auto md:flex-wrap md:justify-start md:gap-3">
          <div className="hidden items-center gap-2 md:order-1 md:flex">
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
          <Button
            variant="outline"
            size="sm"
            className="order-1 md:order-3"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            {t('table.previous')}
          </Button>
          <p aria-live="polite" className="order-2 md:order-2">
            {t('table.pageOf', {
              page: formatNumber(pageIndex + 1),
              total: formatNumber(pageCount),
            })}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="order-3 md:order-4 md:-ms-1"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            {t('table.next')}
          </Button>
        </div>
      )}
    </div>
  );
}
