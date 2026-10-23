import { useTranslation } from 'react-i18next';
import { DateRangePicker } from '@/components/movements/DateRangePicker';
import { ProductPicker } from '@/components/movements/ProductPicker';
import { FilterSelect } from '@/components/products/ProductFilters';
import { Button } from '@/components/ui/button';

export const TYPE_OPTIONS = ['receive', 'ship', 'adjust', 'increment', 'decrement'];

/** The filters above the movements table. The page owns every value (they live in the URL). */
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
  actions = null,
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
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
      <Button variant="outline" size="sm" disabled={!canClear} onClick={onClear}>
        {t('movements.filters.clear')}
      </Button>
      {actions}
    </div>
  );
}
