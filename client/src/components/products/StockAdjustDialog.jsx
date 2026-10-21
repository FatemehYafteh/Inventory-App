import { stockChangeSchema } from '@inventory/shared/schemas';
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
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useZodForm } from '@/hooks/useZodForm';
import { applyFieldErrors, errorMessage } from '@/lib/errors';

const FIELDS = ['quantity', 'note'];

const MODES = {
  receive: {
    label: 'Receive',
    quantityLabel: 'Quantity to add',
    hint: 'Stock that arrived. Recorded against the product’s supplier.',
  },
  ship: {
    label: 'Ship',
    quantityLabel: 'Quantity to remove',
    hint: 'Stock that left. You cannot remove more than is in stock.',
  },
  adjust: {
    label: 'Adjust',
    quantityLabel: 'New quantity',
    hint: 'Set the quantity to a counted total.',
  },
};

/** The quantity after the change, or null while the amount is not a usable number. */
function resultingQuantity(mode, current, amount) {
  if (!Number.isInteger(amount) || amount < 0) return null;
  if (mode === 'receive') return current + amount;
  if (mode === 'ship') return amount > current ? null : current - amount;
  return amount;
}

/**
 * Receive, ship or adjust one product's stock in a dialog. `product` is the live row, so the
 * current quantity stays right if the list reloads; `onSubmit({ type, quantity, note })` returns a
 * promise. The preview shows the quantity the change would leave. A refusal from the server
 * (not enough stock, same quantity) lands on the quantity field, anything else above the fields.
 */
export function StockAdjustDialog({ product, onSubmit, onCancel, onCloseAutoFocus }) {
  const [mode, setMode] = useState('receive');
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    clearErrors,
    watch,
    formState: { errors, isSubmitting },
  } = useZodForm(stockChangeSchema, { defaultValues: { type: 'receive', quantity: '', note: '' } });

  const current = product.quantity;
  const amount = watch('quantity');
  const after = resultingQuantity(mode, current, amount);

  function chooseMode(next) {
    setMode(next);
    setValue('type', next);
    // An amount to add, an amount to remove and a new total are different things: start again.
    setValue('quantity', '');
    clearErrors();
    setFormError(null);
  }

  async function submit(values) {
    setFormError(null);
    if (values.type === 'ship' && values.quantity > current) {
      setError('quantity', { message: `Only ${current} in stock` });
      return;
    }
    if (values.type === 'adjust' && values.quantity === current) {
      setError('quantity', { message: `The quantity is already ${current}` });
      return;
    }
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
            <DialogTitle className="[overflow-wrap:anywhere]">Adjust stock</DialogTitle>
            <DialogDescription className="[overflow-wrap:anywhere]">
              {product.title} ({product.sku})
            </DialogDescription>
          </DialogHeader>
          <FormAlert>{formError}</FormAlert>
          <Tabs value={mode} onValueChange={chooseMode}>
            <TabsList aria-label="Kind of stock change" className="w-full">
              {Object.entries(MODES).map(([value, { label }]) => (
                <TabsTrigger key={value} value={value} className="flex-1">
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <p className="text-sm text-muted-foreground">{MODES[mode].hint}</p>
          <TextField
            id="stock-quantity"
            label={MODES[mode].quantityLabel}
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            error={errors.quantity}
            {...register('quantity', { valueAsNumber: true })}
          />
          <div className="flex flex-col gap-2">
            <Label htmlFor="stock-note">Note (optional)</Label>
            <Textarea
              id="stock-note"
              aria-invalid={Boolean(errors.note)}
              aria-describedby={errors.note ? 'stock-note-error' : undefined}
              {...register('note')}
            />
            {errors.note && (
              <p id="stock-note-error" className="text-sm text-danger">
                {errors.note.message}
              </p>
            )}
          </div>
          <p className="text-sm tabular-nums" aria-live="polite">
            Current quantity: <span className="font-medium">{current}</span>
            {after !== null && (
              <>
                {' '}
                → New quantity: <span className="font-medium">{after}</span>
              </>
            )}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
