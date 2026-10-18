import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PAGE_SIZE_OPTIONS } from '@/components/data-table/DataTablePagination';
import { FormAlert } from '@/components/form/FormAlert';
import { SupplierForm } from '@/components/suppliers/SupplierForm';
import {
  DeactivateSupplierDialog,
  DeleteSupplierDialog,
} from '@/components/suppliers/SupplierDialogs';
import { SupplierTable } from '@/components/suppliers/SupplierTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useReturnFocus } from '@/hooks/useReturnFocus';
import { useMe } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';
import {
  useCreateSupplier,
  useDeleteSupplier,
  useSuppliers,
  useUpdateSupplier,
} from '@/lib/suppliers';

const DEFAULT_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 250;

/**
 * Everyone active browses and searches suppliers; admins add, edit, deactivate, reactivate and
 * delete them. Search, sort and page live in the URL. A row opens Products filtered by supplier.
 */
export function SuppliersPage() {
  const { data: me } = useMe();
  const canManage = me?.role === 'admin';
  const [params, setParams] = useSearchParams();

  const search = params.get('search') ?? '';
  const order = params.get('order') === 'desc' ? 'desc' : 'asc';
  const limit = PAGE_SIZE_OPTIONS.includes(Number(params.get('limit')))
    ? Number(params.get('limit'))
    : DEFAULT_PAGE_SIZE;
  const page = Math.max(Number(params.get('page')) || 1, 1);

  // Changing the search, sort or page size goes back to the first page.
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
    if (searchText === search) return undefined;
    const timer = setTimeout(() => update({ search: searchText.trim() }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText, search, update]);

  const suppliers = useSuppliers({ search, sortBy: 'name', order, page, limit });
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();
  // `mutate` is stable, so the table columns (and the buttons in them) are not rebuilt each render.
  const { mutate: saveSupplier } = updateSupplier;
  const busy = updateSupplier.isPending || deleteSupplier.isPending;

  // `form` is null (closed), { supplier: null } (add) or { supplier } (edit).
  const [form, setForm] = useState(null);
  const [deactivating, setDeactivating] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [actionError, setActionError] = useState(null);

  const headingRef = useRef(null);
  const { remember, onCloseAutoFocus } = useReturnFocus(headingRef);

  const onEdit = useCallback(
    (supplier) => {
      remember();
      setForm({ supplier });
    },
    [remember],
  );

  const setActive = useCallback(
    (supplier, isActive) => {
      setActionError(null);
      saveSupplier(
        { id: supplier.id, isActive },
        { onError: (error) => setActionError(errorMessage(error)) },
      );
    },
    [saveSupplier],
  );

  const onToggleActive = useCallback(
    (supplier) => {
      // Deactivating a supplier that still has products asks first; everything else is immediate.
      if (supplier.isActive && supplier.productCount > 0) {
        remember();
        setDeactivating(supplier);
      } else {
        setActive(supplier, !supplier.isActive);
      }
    },
    [remember, setActive],
  );

  const onDelete = useCallback(
    (supplier) => {
      remember();
      setDeleting(supplier);
    },
    [remember],
  );

  function confirmDelete(supplier) {
    setDeleting(null);
    setActionError(null);
    deleteSupplier.mutate(supplier.id, {
      onError: (error) => setActionError(errorMessage(error)),
    });
  }

  const sorting = useMemo(() => [{ id: 'name', desc: order === 'desc' }], [order]);
  const pagination = useMemo(() => ({ pageIndex: page - 1, pageSize: limit }), [page, limit]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold outline-none">
          Suppliers
        </h1>
        {canManage && <Button onClick={() => onEdit(null)}>Add supplier</Button>}
      </div>
      <FormAlert>{actionError}</FormAlert>

      <SupplierTable
        suppliers={suppliers.data?.items ?? []}
        total={suppliers.data?.total ?? 0}
        canManage={canManage}
        busy={busy}
        sorting={sorting}
        onSortingChange={(updater) => {
          const next = typeof updater === 'function' ? updater(sorting) : updater;
          update({ order: next[0]?.desc ? 'desc' : undefined });
        }}
        pagination={pagination}
        onPaginationChange={(updater) => {
          const next = typeof updater === 'function' ? updater(pagination) : updater;
          update({
            page: next.pageIndex > 0 ? next.pageIndex + 1 : undefined,
            limit: next.pageSize === DEFAULT_PAGE_SIZE ? undefined : next.pageSize,
          });
        }}
        isLoading={suppliers.isPending}
        error={suppliers.error}
        emptyMessage={search ? 'No suppliers match your search.' : 'No suppliers yet.'}
        toolbar={
          <Input
            type="search"
            aria-label="Search suppliers"
            placeholder="Search name, contact person, phone or email"
            className="max-w-sm"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
        }
        onEdit={onEdit}
        onToggleActive={onToggleActive}
        onDelete={onDelete}
      />

      {form && (
        <SupplierForm
          key={form.supplier?.id ?? 'new'}
          supplier={form.supplier}
          onCancel={() => setForm(null)}
          onCloseAutoFocus={onCloseAutoFocus}
          onSubmit={async (values) => {
            if (form.supplier) {
              await updateSupplier.mutateAsync({ id: form.supplier.id, ...values });
            } else {
              await createSupplier.mutateAsync(values);
            }
            setForm(null);
          }}
        />
      )}
      <DeactivateSupplierDialog
        supplier={deactivating}
        onCancel={() => setDeactivating(null)}
        onCloseAutoFocus={onCloseAutoFocus}
        onConfirm={(supplier) => {
          setDeactivating(null);
          setActive(supplier, false);
        }}
      />
      <DeleteSupplierDialog
        supplier={deleting}
        onCancel={() => setDeleting(null)}
        onCloseAutoFocus={onCloseAutoFocus}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
