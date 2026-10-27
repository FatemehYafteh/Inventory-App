import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

const SORT_ICONS = { asc: '↑', desc: '↓' };
const NEXT_SORT_KEYS = { asc: 'table.sortAscending', desc: 'table.sortDescending' };

/** Header label that toggles server-side sorting when the column allows it. */
export function DataTableColumnHeader({ header, children }) {
  const { t } = useTranslation();
  const { column } = header;
  if (!column.getCanSort()) return children;

  const sorted = column.getIsSorted();
  const next = column.getNextSortingOrder();
  const nextLabel = next ? t(NEXT_SORT_KEYS[next]) : t('table.clearSorting');

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
      <span className="sr-only">{t('table.sortHint', { action: nextLabel })}</span>
    </button>
  );
}
