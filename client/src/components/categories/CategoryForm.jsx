import { createCategorySchema } from '@inventory/shared/schemas';
import { useState } from 'react';
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
export function CategoryForm({ category, onSubmit, onCancel }) {
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
      <DialogContent>
        <form noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{category ? 'Edit category' : 'Add category'}</DialogTitle>
            <DialogDescription>
              Every product belongs to one category. Titles are unique, ignoring letter case.
            </DialogDescription>
          </DialogHeader>
          <FormAlert>{formError}</FormAlert>
          <TextField
            id="category-title"
            label="Title"
            error={errors.title}
            {...register('title')}
          />
          <TextField
            id="category-description"
            label="Description"
            error={errors.description}
            {...register('description')}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
