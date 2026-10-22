import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CategoryCard } from '@/components/categories/CategoryCard';
import { CategoryForm } from '@/components/categories/CategoryForm';
import { DeleteCategoryDialog } from '@/components/categories/DeleteCategoryDialog';
import { FormAlert } from '@/components/form/FormAlert';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { useReturnFocus } from '@/hooks/useReturnFocus';
import { useMe } from '@/lib/auth';
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from '@/lib/categories';
import { errorMessage } from '@/lib/errors';

/**
 * Everyone active browses the categories; admins add, edit and delete them. A card opens the
 * Products page filtered by that category.
 */
export function CategoriesPage() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const canManage = me?.role === 'admin';
  const categories = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  // `form` is null (closed), { category: null } (add) or { category } (edit).
  const [form, setForm] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [actionError, setActionError] = useState(null);

  const headingRef = useRef(null);
  const { remember, onCloseAutoFocus } = useReturnFocus(headingRef);
  const items = categories.data?.items ?? [];

  function openForm(category) {
    remember();
    setForm({ category });
  }

  function openDelete(category) {
    remember();
    setDeleting(category);
  }

  function confirmDelete(category) {
    setDeleting(null);
    setActionError(null);
    deleteCategory.mutate(category.id, {
      onError: (error) => setActionError(errorMessage(error)),
    });
  }

  return (
    <section className="@container flex flex-col gap-4">
      <PageHeader
        ref={headingRef}
        title={t('categories.title')}
        actions={canManage && <Button onClick={() => openForm(null)}>{t('categories.add')}</Button>}
      />
      <FormAlert>{actionError}</FormAlert>

      {categories.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('categories.loading')}
        </p>
      )}
      <FormAlert>{categories.error && errorMessage(categories.error)}</FormAlert>
      {categories.isSuccess && items.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('categories.empty')}</p>
      )}
      <div className="grid gap-4 @lg:grid-cols-2 @3xl:grid-cols-3">
        {items.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            canManage={canManage}
            onEdit={openForm}
            onDelete={openDelete}
          />
        ))}
      </div>

      {form && (
        <CategoryForm
          key={form.category?.id ?? 'new'}
          category={form.category}
          onCancel={() => setForm(null)}
          onCloseAutoFocus={onCloseAutoFocus}
          onSubmit={async (values) => {
            if (form.category) {
              await updateCategory.mutateAsync({ id: form.category.id, ...values });
            } else {
              await createCategory.mutateAsync(values);
            }
            setForm(null);
          }}
        />
      )}
      <DeleteCategoryDialog
        category={deleting}
        onCancel={() => setDeleting(null)}
        onCloseAutoFocus={onCloseAutoFocus}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
