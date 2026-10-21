import { createProductSchema } from '@inventory/shared/schemas';
import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { FormAlert } from '@/components/form/FormAlert';
import { TextField } from '@/components/form/TextField';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useZodForm } from '@/hooks/useZodForm';
import { applyFieldErrors, errorMessage } from '@/lib/errors';

const FIELDS = [
  'title',
  'sku',
  'description',
  'category',
  'supplier',
  'price',
  'reorderLevel',
  'initialQuantity',
];
// Radix Select cannot hold an empty value, so "no supplier" is this word in the control only.
const NO_SUPPLIER = 'none';

/** Label, control and error message for controls that are not plain text inputs. */
function Field({ id, label, error, children }) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children(error ? errorId : undefined)}
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error.message}
        </p>
      )}
    </div>
  );
}

/**
 * Add (no `product`) or edit a product in a sheet. Only adding has a quantity field (the initial
 * stock, 0 for none); an existing product's stock changes through stock actions. `suppliers` are
 * the active ones; a product keeps an inactive supplier it already has, shown as an extra choice.
 * `onSubmit(values)` returns a promise; a server validation or duplicate-SKU error lands on its
 * field, anything else shows above the fields.
 */
export function ProductForm({
  product,
  categories,
  suppliers,
  onSubmit,
  onCancel,
  onCloseAutoFocus,
}) {
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useZodForm(createProductSchema, {
    defaultValues: {
      title: product?.title ?? '',
      sku: product?.sku ?? '',
      description: product?.description ?? '',
      category: product?.category?.id ?? '',
      supplier: product?.supplier?.id ?? '',
      price: product?.price ?? '',
      reorderLevel: product?.reorderLevel ?? 0,
      ...(!product && { initialQuantity: 0 }),
    },
  });
  const [formError, setFormError] = useState(null);

  const current = product?.supplier;
  const supplierOptions =
    current && !suppliers.some((supplier) => supplier.id === current.id)
      ? [...suppliers, { id: current.id, name: `${current.name} (inactive)` }]
      : suppliers;

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
    <Sheet open onOpenChange={(open) => !open && onCancel()}>
      <SheetContent className="w-full sm:max-w-lg" onCloseAutoFocus={onCloseAutoFocus}>
        <form noValidate onSubmit={handleSubmit(submit)} className="flex min-h-0 flex-1 flex-col">
          <SheetHeader>
            <SheetTitle>{product ? 'Edit product' : 'Add product'}</SheetTitle>
            <SheetDescription>
              SKUs are unique, ignoring letter case.{' '}
              {product
                ? 'Change stock with stock actions.'
                : 'Set an initial quantity to record it as the first stock receipt.'}
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4">
            <FormAlert>{formError}</FormAlert>
            <TextField
              id="product-title"
              label="Title"
              error={errors.title}
              {...register('title')}
            />
            <TextField id="product-sku" label="SKU" error={errors.sku} {...register('sku')} />
            <Field id="product-description" label="Description" error={errors.description}>
              {(describedBy) => (
                <Textarea
                  id="product-description"
                  aria-invalid={Boolean(errors.description)}
                  aria-describedby={describedBy}
                  {...register('description')}
                />
              )}
            </Field>
            <Field id="product-category" label="Category" error={errors.category}>
              {(describedBy) => (
                <Controller
                  name="category"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger
                        id="product-category"
                        ref={field.ref}
                        onBlur={field.onBlur}
                        aria-invalid={Boolean(errors.category)}
                        aria-describedby={describedBy}
                      >
                        <SelectValue placeholder="Choose a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </Field>
            <Field id="product-supplier" label="Supplier" error={errors.supplier}>
              {(describedBy) => (
                <Controller
                  name="supplier"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value || NO_SUPPLIER}
                      onValueChange={(value) => field.onChange(value === NO_SUPPLIER ? '' : value)}
                    >
                      <SelectTrigger
                        id="product-supplier"
                        ref={field.ref}
                        onBlur={field.onBlur}
                        aria-invalid={Boolean(errors.supplier)}
                        aria-describedby={describedBy}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_SUPPLIER}>No supplier</SelectItem>
                        {supplierOptions.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                id="product-price"
                label="Price"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                error={errors.price}
                {...register('price', { valueAsNumber: true })}
              />
              <TextField
                id="product-reorder-level"
                label="Reorder level"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                error={errors.reorderLevel}
                {...register('reorderLevel', { valueAsNumber: true })}
              />
            </div>
            {!product && (
              <TextField
                id="product-initial-quantity"
                label="Initial quantity"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                error={errors.initialQuantity}
                {...register('initialQuantity', { valueAsNumber: true })}
              />
            )}
          </div>
          <SheetFooter className="flex-col-reverse sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
