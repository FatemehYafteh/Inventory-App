import { createCategorySchema } from '@inventory/shared/schemas';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormAlert } from '@/components/form/FormAlert';
import { TextField } from '@/components/form/TextField';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useZodForm } from '@/hooks/useZodForm';
import { applyFieldErrors, errorMessage } from '@/lib/errors';

const FIELDS = ['title', 'description'];

/**
 * Add (no `category`) or edit a category. `onSubmit(values)` returns a promise; a server
 * validation or duplicate-title error lands on its field, anything else shows above the fields.
 */
export function CategoryForm({ category, onSubmit, onCancel, onCloseAutoFocus }) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useZodForm(createCategorySchema, {
    defaultValues: { title: category?.title ?? '', description: category?.description ?? '' },
  });
  const [formError, setFormError] = useState(null);

  async function submit(values) {
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      applyFieldErrors(error, setError, FIELDS);
      if (!error?.errors) setFormError(errorMessage(error));
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <form noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {category ? t('categories.form.editTitle') : t('categories.form.addTitle')}
            </DialogTitle>
            <DialogDescription>{t('categories.form.description')}</DialogDescription>
          </DialogHeader>
          <FormAlert>{formError}</FormAlert>
          <TextField
            id="category-title"
            label={t('categories.form.titleLabel')}
            error={errors.title}
            {...register('title')}
          />
          <TextField
            id="category-description"
            label={t('categories.form.descriptionLabel')}
            error={errors.description}
            {...register('description')}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              {t('categories.form.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {t('categories.form.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
