import { SlidersHorizontalIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { formatNumber } from '@/lib/format';

/**
 * The filters of a page below `md`: the search box (when the page has one) stays visible, and
 * one "Filters" button, with the number of active filters, opens a bottom sheet that holds the
 * controls and Clear filters. `children` are the controls, stacked.
 */
export function MobileFilters({
  search = null,
  activeCount,
  canClear,
  onClear,
  clearLabel,
  children,
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      {search}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" className="w-full justify-start gap-2">
            <SlidersHorizontalIcon aria-hidden="true" />
            {t('common.filters')}
            {activeCount > 0 && (
              <Badge variant="secondary" className="ms-auto">
                {formatNumber(activeCount)}
                <span className="sr-only">{t('common.filtersActive', { count: activeCount })}</span>
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85svh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t('common.filters')}</SheetTitle>
            <SheetDescription className="sr-only">
              {t('common.filtersDescription')}
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4">{children}</div>
          <SheetFooter className="flex-col-reverse gap-2">
            <SheetClose asChild>
              <Button>{t('common.done')}</Button>
            </SheetClose>
            <Button variant="outline" disabled={!canClear} onClick={onClear}>
              {clearLabel}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
