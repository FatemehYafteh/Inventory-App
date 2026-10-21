import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PAGE_SIZE_OPTIONS } from '@/components/data-table/DataTablePagination';
import { FormAlert } from '@/components/form/FormAlert';
import { PageHeader } from '@/components/layout/PageHeader';
import { ArchiveProductDialog } from '@/components/products/ArchiveProductDialog';
import { ProductFilters, STATUS_OPTIONS } from '@/components/products/ProductFilters';
import { ProductForm } from '@/components/products/ProductForm';
import { ProductTable } from '@/components/products/ProductTable';
import { StockAdjustDialog } from '@/components/products/StockAdjustDialog';
import { StockHistoryDialog } from '@/components/products/StockHistoryDialog';
import { Button } from '@/components/ui/button';
import { useReturnFocus } from '@/hooks/useReturnFocus';
import { useMe } from '@/lib/auth';
import { useCategories } from '@/lib/categories';
import { errorMessage } from '@/lib/errors';
import {
  useArchiveProduct,
  useChangeStock,
  useCreateProduct,
  useProducts,
  useRestoreProduct,
  useStockStep,
  useUpdateProduct,
} from '@/lib/products';
import { useSuppliers } from '@/lib/suppliers';

const DEFAULT_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const SORT_FIELDS = ['title', 'quantity', 'price'];
const OBJECT_ID = /^[a-f\d]{24}$/i;
// The API caps a page at 100 suppliers, so the supplier filter lists at most that many.
const SUPPLIER_FILTER_LIMIT = 100;

/**
 * Everyone active browses products, admins and staff add and edit them, and only admins archive
 * and restore them. Search, filters, sort and
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
  // New choices in the form are limited to active suppliers.
  const activeSuppliers = useSuppliers({
    active: 'true',
    sortBy: 'name',
    limit: SUPPLIER_FILTER_LIMIT,
  });
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const { mutate: archiveProduct } = useArchiveProduct();
  const { mutate: restoreProduct } = useRestoreProduct();
  const stockStep = useStockStep();
  const changeStock = useChangeStock();

  // `form` is null (closed), { product: null } (add) or { product } (edit).
  const [form, setForm] = useState(null);
  const headingRef = useRef(null);
  const { remember, onCloseAutoFocus } = useReturnFocus(headingRef);
  const openForm = useCallback(
    (product) => {
      remember();
      setForm({ product });
    },
    [remember],
  );

  // The id, not the row: the dialog reads the live product, so its current quantity stays right.
  const [adjustingId, setAdjustingId] = useState(null);
  const adjusting = products.data?.items.find((item) => item.id === adjustingId);
  const openAdjust = useCallback(
    (product) => {
      remember();
      setAdjustingId(product.id);
    },
    [remember],
  );
  const [historyOf, setHistoryOf] = useState(null);
  const openHistory = useCallback(
    (product) => {
      remember();
      setHistoryOf(product);
    },
    [remember],
  );
  const [archiving, setArchiving] = useState(null);
  const [actionError, setActionError] = useState(null);
  const openArchive = useCallback(
    (product) => {
      remember();
      setArchiving(product);
    },
    [remember],
  );
  const restore = useCallback(
    (product) => {
      setActionError(null);
      restoreProduct(product.id, { onError: (error) => setActionError(errorMessage(error)) });
    },
    [restoreProduct],
  );
  function confirmArchive(product) {
    setArchiving(null);
    setActionError(null);
    archiveProduct(product.id, { onError: (error) => setActionError(errorMessage(error)) });
  }

  const step = useCallback(
    (product, delta) => {
      setActionError(null);
      stockStep(product, delta, { onError: (error) => setActionError(errorMessage(error)) });
    },
    [stockStep],
  );

  const sorting = useMemo(() => [{ id: sortBy, desc: order === 'desc' }], [sortBy, order]);
  const pagination = useMemo(() => ({ pageIndex: page - 1, pageSize: limit }), [page, limit]);
  const filtered = Boolean(search || category || supplier || status || archived);

  return (
    <section className="flex flex-col gap-4">
      <PageHeader
        ref={headingRef}
        title="Products"
        description="Find products and check their stock."
        actions={<Button onClick={() => openForm(null)}>Add Product</Button>}
      />
      <FormAlert>{actionError}</FormAlert>
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
        onEdit={openForm}
        onStep={step}
        onAdjust={openAdjust}
        onHistory={openHistory}
        canArchive={isAdmin}
        onArchive={openArchive}
        onRestore={restore}
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
      <ArchiveProductDialog
        product={archiving}
        onCancel={() => setArchiving(null)}
        onCloseAutoFocus={onCloseAutoFocus}
        onConfirm={confirmArchive}
      />
      {adjusting && (
        <StockAdjustDialog
          key={adjusting.id}
          product={adjusting}
          onCancel={() => setAdjustingId(null)}
          onCloseAutoFocus={onCloseAutoFocus}
          onSubmit={async (values) => {
            await changeStock.mutateAsync({ id: adjusting.id, ...values });
            setAdjustingId(null);
          }}
        />
      )}
      {historyOf && (
        <StockHistoryDialog
          key={historyOf.id}
          product={historyOf}
          onClose={() => setHistoryOf(null)}
          onCloseAutoFocus={onCloseAutoFocus}
        />
      )}
      {form && (
        <ProductForm
          key={form.product?.id ?? 'new'}
          product={form.product}
          categories={categories.data?.items ?? []}
          suppliers={activeSuppliers.data?.items ?? []}
          onCancel={() => setForm(null)}
          onCloseAutoFocus={onCloseAutoFocus}
          onSubmit={async (values) => {
            if (form.product) {
              await updateProduct.mutateAsync({ id: form.product.id, ...values });
            } else {
              await createProduct.mutateAsync(values);
            }
            setForm(null);
          }}
        />
      )}
    </section>
  );
}
