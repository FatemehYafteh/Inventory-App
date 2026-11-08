import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { translateMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';

/**
 * Label + input + error message, wired for accessibility. Spread `register(name)` into it.
 * `hideLabel` keeps the label for screen readers when the page already shows the same text.
 * `optional` adds "(optional)" to the label. `hint` is help text under the input. `prefix` is a
 * symbol inside the field at its start; the field follows the input's `dir`, so a price with
 * `dir="ltr"` keeps the symbol on the left in every language.
 */
export const TextField = forwardRef(function TextField(
  { id, label, hideLabel = false, optional = false, hint, prefix, error, className, ...props },
  ref,
) {
  const { t } = useTranslation();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(' ') || undefined;
  const input = (
    <Input
      ref={ref}
      id={id}
      aria-invalid={Boolean(error)}
      aria-describedby={describedBy}
      className={prefix ? 'ps-7' : undefined}
      {...props}
    />
  );
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={id} className={hideLabel ? 'sr-only' : undefined}>
        {label}
        {optional && (
          <>
            {' '}
            <span className="font-normal text-muted-foreground">{t('common.optional')}</span>
          </>
        )}
      </Label>
      {prefix ? (
        <div className="relative" dir={props.dir}>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-sm text-muted-foreground"
          >
            {prefix}
          </span>
          {input}
        </div>
      ) : (
        input
      )}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {translateMessage(error.message)}
        </p>
      )}
    </div>
  );
});
