import { createSupplierSchema } from '@inventory/shared/schemas';
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

const FIELDS = ['name', 'contactPerson', 'phone', 'email', 'address', 'notes'];

/**
 * Add (no `supplier`) or edit a supplier. `onSubmit(values)` returns a promise; a server
 * validation or duplicate-name error lands on its field, anything else shows above the fields.
 */
export function SupplierForm({ supplier, onSubmit, onCancel, onCloseAutoFocus }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useZodForm(createSupplierSchema, {
    defaultValues: Object.fromEntries(FIELDS.map((field) => [field, supplier?.[field] ?? ''])),
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
            <DialogTitle>{supplier ? 'Edit supplier' : 'Add supplier'}</DialogTitle>
            <DialogDescription>
              Names are unique, ignoring letter case. Only the name is required.
            </DialogDescription>
          </DialogHeader>
          <FormAlert>{formError}</FormAlert>
          <TextField id="supplier-name" label="Name" error={errors.name} {...register('name')} />
          <TextField
            id="supplier-contact"
            label="Contact person"
            error={errors.contactPerson}
            {...register('contactPerson')}
          />
          <TextField
            id="supplier-phone"
            label="Phone"
            error={errors.phone}
            {...register('phone')}
          />
          <TextField
            id="supplier-email"
            label="Email"
            type="email"
            error={errors.email}
            {...register('email')}
          />
          <TextField
            id="supplier-address"
            label="Address"
            error={errors.address}
            {...register('address')}
          />
          <TextField
            id="supplier-notes"
            label="Notes"
            error={errors.notes}
            {...register('notes')}
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
