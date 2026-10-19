import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * The page's level-1 heading, with an optional description and a slot for page actions.
 * The ref goes to the <h1>, which is focusable by code so pages can return focus to it
 * (see useReturnFocus). `centered` is for standalone pages without a layout, like Not found.
 */
export const PageHeader = forwardRef(function PageHeader(
  { title, description, actions, centered = false },
  ref,
) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-4 gap-y-2',
        centered && 'justify-center text-center',
      )}
    >
      <div className={cn('flex flex-col gap-1', centered && 'items-center')}>
        <h1 ref={ref} tabIndex={-1} className="text-2xl font-semibold outline-none">
          {title}
        </h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
});
