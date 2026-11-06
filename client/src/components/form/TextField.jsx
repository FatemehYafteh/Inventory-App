import { forwardRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { translateMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';

/**
 * Label + input + error message, wired for accessibility. Spread `register(name)` into it.
 * `hideLabel` keeps the label for screen readers when the page already shows the same text.
 */
export const TextField = forwardRef(function TextField(
  { id, label, hideLabel = false, error, className, ...props },
  ref,
) {
  const errorId = `${id}-error`;
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={id} className={hideLabel ? 'sr-only' : undefined}>
        {label}
      </Label>
      <Input
        ref={ref}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {translateMessage(error.message)}
        </p>
      )}
    </div>
  );
});
