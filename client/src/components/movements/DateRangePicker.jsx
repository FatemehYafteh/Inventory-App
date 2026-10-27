import { CalendarIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { daysToInstants, instantsToDays } from '@/lib/dateRange';
import { formatDate } from '@/lib/format';

/**
 * Chooses a range of days. `from` and `to` are the API instants (start of the first day, start
 * of the day after the last one) in the browser zone; the calendar is Jalali in Persian.
 */
export function DateRangePicker({ from, to, onChange }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const days = instantsToDays({ from, to });

  let label = t('movements.filters.anyDate');
  if (days.from) {
    const first = formatDate(days.from);
    const last = days.to ? formatDate(days.to) : first;
    label = first === last ? first : t('movements.filters.dateRange', { from: first, to: last });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={t('movements.filters.dates')}
          className="w-full justify-start gap-2 sm:w-auto sm:min-w-52"
        >
          <CalendarIcon className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={days.from ? { from: days.from, to: days.to } : undefined}
          defaultMonth={days.from}
          onSelect={(range) => onChange(range ? daysToInstants(range) : { from: '', to: '' })}
        />
        <div className="flex justify-end border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={!days.from}
            onClick={() => onChange({ from: '', to: '' })}
          >
            {t('movements.filters.clearDates')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
