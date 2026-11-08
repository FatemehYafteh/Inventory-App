import { stockChangeSchema } from '@inventory/shared/schemas';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { FormAlert } from '@/components/form/FormAlert';
import { TextField } from '@/components/form/TextField';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/format';
import { parseNumberInput } from '@/lib/numbers';
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
import { applyFieldErrors, errorMessage, translateMessage } from '@/lib/errors';

const FIELDS = ['quantity', 'note'];

const MODES = ['receive', 'ship', 'adjust'];

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
  const { t } = useTranslation();
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
      setError('quantity', {
        message: t('products.adjust.onlyInStock', { n: formatNumber(current) }),
      });
      return;
    }
    if (values.type === 'adjust' && values.quantity === current) {
      setError('quantity', {
        message: t('products.adjust.alreadyQuantity', { n: formatNumber(current) }),
      });
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
            <DialogTitle className="[overflow-wrap:anywhere]">
              {t('products.adjust.title')}
            </DialogTitle>
            <DialogDescription className="[overflow-wrap:anywhere]">
              <bdi>{product.title}</bdi> (<bdi>{product.sku}</bdi>)
            </DialogDescription>
            {/* The current stock, and while an amount is typed, what it would leave. */}
            <p className="text-sm tabular-nums" aria-live="polite">
              {after === null ? (
                <Trans
                  i18nKey="products.adjust.stock"
                  values={{ n: formatNumber(current) }}
                  components={{ value: <span className="font-medium" /> }}
                />
              ) : (
                <Trans
                  i18nKey="products.adjust.stockChange"
                  values={{ from: formatNumber(current), to: formatNumber(after) }}
                  components={{ value: <span className="font-medium" /> }}
                />
              )}
            </p>
          </DialogHeader>
          <FormAlert>{formError}</FormAlert>
          <Tabs value={mode} onValueChange={chooseMode}>
            <TabsList aria-label={t('products.adjust.kindLabel')} className="w-full">
              {MODES.map((value) => (
                <TabsTrigger key={value} value={value} className="flex-1">
                  {t(`products.adjust.${value}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <p className="text-sm text-muted-foreground">
            {mode === 'receive' ? (
              product.supplier ? (
                <Trans
                  i18nKey="products.adjust.receiveHint"
                  // A name that already ends with a full stop ("Co.") does not get a second one.
                  values={{
                    supplier: product.supplier.name,
                    end: product.supplier.name.endsWith('.') ? '' : '.',
                  }}
                  components={{ name: <bdi className="font-medium text-foreground" /> }}
                />
              ) : (
                t('products.adjust.receiveHintNoSupplier')
              )
            ) : (
              t(`products.adjust.${mode}Hint`)
            )}
          </p>
          <TextField
            id="stock-quantity"
            label={t(`products.adjust.${mode}Quantity`)}
            inputMode="numeric"
            autoComplete="off"
            error={errors.quantity}
            {...register('quantity', { setValueAs: parseNumberInput })}
          />
          <div className="flex flex-col gap-2">
            <Label htmlFor="stock-note">{t('products.adjust.note')}</Label>
            <Textarea
              id="stock-note"
              dir="auto"
              aria-invalid={Boolean(errors.note)}
              aria-describedby={errors.note ? 'stock-note-error' : undefined}
              {...register('note')}
            />
            {errors.note && (
              <p id="stock-note-error" className="text-sm text-danger">
                {translateMessage(errors.note.message)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              {t('products.adjust.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('products.adjust.saving') : t('products.adjust.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
