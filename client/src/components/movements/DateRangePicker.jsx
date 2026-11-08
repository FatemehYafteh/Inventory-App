import { CalendarIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { daysToInstants, instantsToDays } from '@/lib/dateRange';
import { formatDate } from '@/lib/format';

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * Chooses a range of days. `from` and `to` are the API instants (start of the first day, start
 * of the day after the last one) in the browser zone; the calendar is Jalali in Persian.
 *
 * On a large screen the calendar floats in a popover. Below `md` (where this sits inside the
 * filters sheet) it opens inline under the field instead, so the sheet grows rather than a
 * second layer opening over it. Either way it closes once the end date is picked, and "Apply"
 * closes it when only one day was picked.
 */
export function DateRangePicker({ from, to, onChange }) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const days = instantsToDays({ from, to });

  let label = t('movements.filters.anyDate');
  if (days.from) {
    const first = formatDate(days.from);
    const last = days.to ? formatDate(days.to) : first;
    label = first === last ? first : t('movements.filters.dateRange', { from: first, to: last });
  }

  function select(range) {
    onChange(range ? daysToInstants(range) : { from: '', to: '' });
    // A finished range (two different days) is done; one day waits for a second click or Apply.
    if (range?.from && range?.to && !sameDay(range.from, range.to)) setOpen(false);
  }

  const calendar = (
    <>
      <Calendar
        mode="range"
        selected={days.from ? { from: days.from, to: days.to } : undefined}
        defaultMonth={days.from}
        onSelect={select}
      />
      <div className="flex w-full justify-end gap-2 border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={!days.from}
          onClick={() => onChange({ from: '', to: '' })}
        >
          {t('movements.filters.clearDates')}
        </Button>
        <Button size="sm" onClick={() => setOpen(false)}>
          {t('movements.filters.applyDates')}
        </Button>
      </div>
    </>
  );

  const trigger = (extra) => (
    <Button
      variant="outline"
      aria-label={t('movements.filters.dates')}
      className="w-full justify-start gap-2 sm:w-auto sm:min-w-52"
      {...extra}
    >
      <CalendarIcon className="size-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </Button>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col gap-2">
        {trigger({
          'aria-expanded': open,
          'aria-controls': panelId,
          onClick: () => setOpen((value) => !value),
        })}
        {open && (
          <div id={panelId} className="flex flex-col items-center rounded-md border">
            {calendar}
          </div>
        )}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger()}</PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {calendar}
      </PopoverContent>
    </Popover>
  );
}
