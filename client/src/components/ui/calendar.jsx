import { DayPicker as PersianDayPicker } from '@daypicker/persian';
import { DayPicker } from '@daypicker/react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function Chevron({ orientation, className }) {
  const Icon = orientation === 'left' ? ChevronLeftIcon : ChevronRightIcon;
  return <Icon className={cn('size-4 rtl:rotate-180', className)} aria-hidden="true" />;
}

// Date picker for the Movements date-range filter (sub-PRD 08). Styled with Tailwind, so
// DayPicker's own stylesheet is not imported.
function Calendar({ className, classNames, showOutsideDays = true, ...props }) {
  const { i18n } = useTranslation();
  // Persian shows the Jalali calendar (right to left, Persian digits); the dates it selects are
  // ordinary Date values, so what the rest of the app stores and sends does not change.
  const Picker = i18n.language === 'fa' ? PersianDayPicker : DayPicker;
  return (
    <Picker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'relative flex flex-col gap-4 sm:flex-row',
        month: 'flex flex-col gap-4',
        month_caption: 'flex h-8 items-center justify-center',
        caption_label: 'text-sm font-medium',
        nav: 'absolute inset-x-0 top-0 flex items-center justify-between',
        button_previous: cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'size-8 p-0'),
        button_next: cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'size-8 p-0'),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'w-8 text-xs font-normal text-muted-foreground',
        week: 'mt-1 flex w-full',
        day: 'relative size-8 p-0 text-center text-sm',
        day_button: cn(
          buttonVariants({ variant: 'ghost', size: 'sm' }),
          'size-8 p-0 font-normal aria-selected:opacity-100',
        ),
        selected:
          '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary',
        range_start: 'rounded-s-md bg-accent',
        range_middle:
          'bg-accent [&>button]:bg-transparent [&>button]:text-accent-foreground [&>button]:hover:bg-transparent',
        range_end: 'rounded-e-md bg-accent',
        today: '[&>button]:font-semibold [&>button]:underline',
        outside: 'text-muted-foreground opacity-50',
        disabled: 'text-muted-foreground opacity-50',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{ Chevron }}
      {...props}
    />
  );
}

export { Calendar };
