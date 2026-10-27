import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ALL = 'all';

export const STATUS_OPTIONS = [
  { value: 'in_stock', labelKey: 'products.stockStatus.inStock' },
  { value: 'low_stock', labelKey: 'products.stockStatus.lowStock' },
  { value: 'out_of_stock', labelKey: 'products.stockStatus.outOfStock' },
];

/** A single select whose "All" choice clears the filter. Radix needs a non-empty value for it. */
export function FilterSelect({ label, allLabel, value, options, onChange }) {
  const { t } = useTranslation();
  return (
    <Select value={value || ALL} onValueChange={(next) => onChange(next === ALL ? '' : next)}>
      <SelectTrigger aria-label={label} className="w-full sm:w-auto sm:min-w-44">
        <SelectValue placeholder={allLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label ?? t(option.labelKey)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Search and filters above the products table. The page owns every value (they live in the URL).
 * The "Show archived" checkbox only exists for admins.
 */
export function ProductFilters({
  searchText,
  onSearchTextChange,
  category,
  supplier,
  status,
  showArchived,
  canShowArchived,
  categories,
  suppliers,
  onChange,
  onClear,
  canClear,
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          type="search"
          aria-label={t('products.filters.searchLabel')}
          placeholder={t('products.filters.searchPlaceholder')}
          className="sm:max-w-xs"
          value={searchText}
          onChange={(event) => onSearchTextChange(event.target.value)}
        />
        <FilterSelect
          label={t('products.filters.category')}
          allLabel={t('products.filters.allCategories')}
          value={category}
          options={categories.map((item) => ({ value: item.id, label: item.title }))}
          onChange={(value) => onChange({ category: value })}
        />
        <FilterSelect
          label={t('products.filters.supplier')}
          allLabel={t('products.filters.allSuppliers')}
          value={supplier}
          options={suppliers.map((item) => ({ value: item.id, label: item.name }))}
          onChange={(value) => onChange({ supplier: value })}
        />
        <FilterSelect
          label={t('products.filters.stockStatus')}
          allLabel={t('products.filters.allStockStatuses')}
          value={status}
          options={STATUS_OPTIONS}
          onChange={(value) => onChange({ status: value })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {canShowArchived && (
          <div className="flex items-center gap-2">
            <input
              id="show-archived"
              type="checkbox"
              className="size-4 accent-primary"
              checked={showArchived}
              onChange={(event) => onChange({ archived: event.target.checked ? 'true' : '' })}
            />
            <Label htmlFor="show-archived">{t('products.filters.showArchived')}</Label>
          </div>
        )}
        <Button variant="outline" size="sm" disabled={!canClear} onClick={onClear}>
          {t('products.filters.clear')}
        </Button>
      </div>
    </div>
  );
}
