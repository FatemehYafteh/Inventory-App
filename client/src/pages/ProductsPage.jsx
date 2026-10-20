import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PAGE_SIZE_OPTIONS } from '@/components/data-table/DataTablePagination';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProductFilters, STATUS_OPTIONS } from '@/components/products/ProductFilters';
import { ProductTable } from '@/components/products/ProductTable';
import { useMe } from '@/lib/auth';
import { useCategories } from '@/lib/categories';
import { useProducts } from '@/lib/products';
import { useSuppliers } from '@/lib/suppliers';

const DEFAULT_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const SORT_FIELDS = ['title', 'quantity', 'price'];
const OBJECT_ID = /^[a-f\d]{24}$/i;
// The API caps a page at 100 suppliers, so the supplier filter lists at most that many.
const SUPPLIER_FILTER_LIMIT = 100;

/**
 * Everyone active browses products; the table is read-only for now. Search, filters, sort and
 * page live in the URL, and a value that does not make sense falls back to its default. Only
 * admins can include archived products (the API refuses it for staff).
 */
export function ProductsPage() {
  const { data: me } = useMe();
  const isAdmin = me?.role === 'admin';
  const [params, setParams] = useSearchParams();

  const search = params.get('search') ?? '';
  const category = OBJECT_ID.test(params.get('category') ?? '') ? params.get('category') : '';
  const supplier = OBJECT_ID.test(params.get('supplier') ?? '') ? params.get('supplier') : '';
  const status = STATUS_OPTIONS.some((option) => option.value === params.get('status'))
    ? params.get('status')
    : '';
  const archived = isAdmin && params.get('archived') === 'true';
  const sortBy = SORT_FIELDS.includes(params.get('sortBy')) ? params.get('sortBy') : 'title';
  const order = params.get('order') === 'desc' ? 'desc' : 'asc';
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

  const [searchText, setSearchText] = useState(search);
  useEffect(() => {
    if (searchText.trim() === search) return undefined;
    const timer = setTimeout(() => update({ search: searchText.trim() }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText, search, update]);

  const products = useProducts({
    search,
    category,
    supplier,
    status,
    archived: archived ? 'true' : undefined,
    sortBy,
    order,
    page,
    limit,
  });
  const categories = useCategories();
  const suppliers = useSuppliers({ sortBy: 'name', limit: SUPPLIER_FILTER_LIMIT });

  const sorting = useMemo(() => [{ id: sortBy, desc: order === 'desc' }], [sortBy, order]);
  const pagination = useMemo(() => ({ pageIndex: page - 1, pageSize: limit }), [page, limit]);
  const filtered = Boolean(search || category || supplier || status || archived);

  return (
    <section className="flex flex-col gap-4">
      <PageHeader title="Products" description="Find products and check their stock." />
      <ProductTable
        products={products.data?.items ?? []}
        total={products.data?.total ?? 0}
        sorting={sorting}
        onSortingChange={(updater) => {
          const next = typeof updater === 'function' ? updater(sorting) : updater;
          // Clearing the sort goes back to the default: Title, ascending.
          update({
            sortBy: next[0] && next[0].id !== 'title' ? next[0].id : undefined,
            order: next[0]?.desc ? 'desc' : undefined,
          });
        }}
        pagination={pagination}
        onPaginationChange={(updater) => {
          const next = typeof updater === 'function' ? updater(pagination) : updater;
          update({
            page: next.pageIndex > 0 ? next.pageIndex + 1 : undefined,
            limit: next.pageSize === DEFAULT_PAGE_SIZE ? undefined : next.pageSize,
          });
        }}
        isLoading={products.isPending}
        error={products.error}
        emptyMessage={filtered ? 'No products match your filters.' : 'No products yet.'}
        toolbar={
          <ProductFilters
            searchText={searchText}
            onSearchTextChange={setSearchText}
            category={category}
            supplier={supplier}
            status={status}
            showArchived={archived}
            canShowArchived={isAdmin}
            categories={categories.data?.items ?? []}
            suppliers={suppliers.data?.items ?? []}
            onChange={update}
            canClear={filtered}
            onClear={() => {
              setSearchText('');
              update({
                search: undefined,
                category: undefined,
                supplier: undefined,
                status: undefined,
                archived: undefined,
              });
            }}
          />
        }
      />
    </section>
  );
}
