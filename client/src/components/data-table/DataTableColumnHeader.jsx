import { cn } from '@/lib/utils';

const SORT_ICONS = { asc: '↑', desc: '↓' };
const NEXT_SORT_LABELS = { asc: 'ascending', desc: 'descending' };

/** Header label that toggles server-side sorting when the column allows it. */
export function DataTableColumnHeader({ header, children }) {
  const { column } = header;
  if (!column.getCanSort()) return children;

  const sorted = column.getIsSorted();
  const next = column.getNextSortingOrder();
  const nextLabel = next ? `sort ${NEXT_SORT_LABELS[next]}` : 'clear sorting';

  return (
    <button
      type="button"
      onClick={column.getToggleSortingHandler()}
      className={cn(
        '-ms-2 inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-accent',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
      )}
    >
      {children}
      <span aria-hidden="true" className={cn('text-xs', !sorted && 'text-muted-foreground')}>
        {sorted ? SORT_ICONS[sorted] : '↕'}
      </span>
      <span className="sr-only">, {nextLabel}</span>
    </button>
  );
}
