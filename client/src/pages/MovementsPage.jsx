import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { PAGE_SIZE_OPTIONS } from '@/components/data-table/DataTablePagination';
import { PageHeader } from '@/components/layout/PageHeader';
import { MovementFilters, TYPE_OPTIONS } from '@/components/movements/MovementFilters';
import { MovementTable } from '@/components/movements/MovementTable';
import { useMe } from '@/lib/auth';
import { usePerformers, useStockMovements } from '@/lib/movements';
import { useSuppliers } from '@/lib/suppliers';

const DEFAULT_PAGE_SIZE = 20;
const OBJECT_ID = /^[a-f\d]{24}$/i;
// The API caps a page at 100 suppliers, so the supplier filter lists at most that many.
const SUPPLIER_FILTER_LIMIT = 100;

const validId = (value) => (OBJECT_ID.test(value ?? '') ? value : '');
const validInstant = (value) => (value && !Number.isNaN(Date.parse(value)) ? value : '');

/**
 * Every stock movement, newest first. Filters and the page live in the URL, so a link such as
 * `/movements?user=<id>` (from the Users drawer) opens already filtered. `from` and `to` are the
 * API instants for the chosen days in the browser zone (`to` is exclusive). Admins can also pick
 * archived products; staff never see their movements.
 */
export function MovementsPage() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const isAdmin = me?.role === 'admin';
  const [params, setParams] = useSearchParams();

  const product = validId(params.get('product'));
  const type = TYPE_OPTIONS.includes(params.get('type')) ? params.get('type') : '';
  const supplier = validId(params.get('supplier'));
  const user = validId(params.get('user'));
  const from = validInstant(params.get('from'));
  // The API refuses an end without a start, so a lone `to` in the URL is ignored.
  const to = from ? validInstant(params.get('to')) : '';
  const limit = PAGE_SIZE_OPTIONS.includes(Number(params.get('limit')))
    ? Number(params.get('limit'))
    : DEFAULT_PAGE_SIZE;
  const page = Math.max(Number(params.get('page')) || 1, 1);

  // Any change goes back to the first page unless it sets the page itself.
  const update = useCallback(
    (changes) => {
      setParams((previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries({ page: undefined, ...changes })) {
          if (value === undefined || value === '') next.delete(key);
          else next.set(key, String(value));
        }
        return next;
      });
    },
    [setParams],
  );

  const movements = useStockMovements({ product, type, supplier, user, from, to, page, limit });
  const suppliers = useSuppliers({ sortBy: 'name', limit: SUPPLIER_FILTER_LIMIT });
  const performers = usePerformers();

  const pagination = useMemo(() => ({ pageIndex: page - 1, pageSize: limit }), [page, limit]);
  const filtered = Boolean(product || type || supplier || user || from);

  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t('movements.page.title')} description={t('movements.page.description')} />
      <MovementTable
        movements={movements.data?.items ?? []}
        total={movements.data?.total ?? 0}
        pagination={pagination}
        onPaginationChange={(updater) => {
          const next = typeof updater === 'function' ? updater(pagination) : updater;
          update({
            page: next.pageIndex > 0 ? next.pageIndex + 1 : undefined,
            limit: next.pageSize === DEFAULT_PAGE_SIZE ? undefined : next.pageSize,
          });
        }}
        isLoading={movements.isPending}
        error={movements.error}
        emptyMessage={filtered ? t('movements.page.emptyFiltered') : t('movements.page.empty')}
        toolbar={
          <MovementFilters
            product={product}
            type={type}
            supplier={supplier}
            user={user}
            from={from}
            to={to}
            suppliers={suppliers.data?.items ?? []}
            performers={performers.data?.items ?? []}
            includeArchived={isAdmin}
            onChange={update}
            canClear={filtered}
            onClear={() =>
              update({
                product: undefined,
                type: undefined,
                supplier: undefined,
                user: undefined,
                from: undefined,
                to: undefined,
              })
            }
          />
        }
      />
    </section>
  );
}
