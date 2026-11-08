import { useTranslation } from 'react-i18next';
import { MobileFilters } from '@/components/data-table/MobileFilters';
import { DateRangePicker } from '@/components/movements/DateRangePicker';
import { ProductPicker } from '@/components/movements/ProductPicker';
import { FilterSelect } from '@/components/products/ProductFilters';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/useMediaQuery';

export const TYPE_OPTIONS = ['receive', 'ship', 'adjust', 'increment', 'decrement'];

/**
 * The filters above the movements table. The page owns every value (they live in the URL).
 * Below `md` they move into a "Filters" bottom sheet.
 */
export function MovementFilters({
  product,
  type,
  supplier,
  user,
  from,
  to,
  suppliers,
  performers,
  includeArchived,
  onChange,
  canClear,
  onClear,
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const controls = (
    <>
      <ProductPicker
        value={product}
        includeArchived={includeArchived}
        onChange={(value) => onChange({ product: value })}
      />
      <FilterSelect
        label={t('movements.filters.type')}
        allLabel={t('movements.filters.allTypes')}
        value={type}
        options={TYPE_OPTIONS.map((value) => ({ value, label: t(`movements.types.${value}`) }))}
        onChange={(value) => onChange({ type: value })}
      />
      <FilterSelect
        label={t('movements.filters.supplier')}
        allLabel={t('movements.filters.allSuppliers')}
        value={supplier}
        options={suppliers.map((item) => ({ value: item.id, label: item.name }))}
        onChange={(value) => onChange({ supplier: value })}
      />
      <FilterSelect
        label={t('movements.filters.user')}
        allLabel={t('movements.filters.allUsers')}
        value={user}
        options={performers.map((item) => ({ value: item.id, label: item.name }))}
        onChange={(value) => onChange({ user: value })}
      />
      <DateRangePicker from={from} to={to} onChange={onChange} />
    </>
  );

  if (isMobile) {
    return (
      <MobileFilters
        activeCount={[product, type, supplier, user, from || to].filter(Boolean).length}
        canClear={canClear}
        onClear={onClear}
        clearLabel={t('movements.filters.clear')}
      >
        {controls}
      </MobileFilters>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      {controls}
      <Button variant="outline" size="sm" disabled={!canClear} onClick={onClear}>
        {t('movements.filters.clear')}
      </Button>
    </div>
  );
}
