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
  { value: 'in_stock', label: 'In stock' },
  { value: 'low_stock', label: 'Low stock' },
  { value: 'out_of_stock', label: 'Out of stock' },
];

/** A single select whose "All" choice clears the filter. Radix needs a non-empty value for it. */
function FilterSelect({ label, allLabel, value, options, onChange }) {
  return (
    <Select value={value || ALL} onValueChange={(next) => onChange(next === ALL ? '' : next)}>
      <SelectTrigger aria-label={label} className="w-full sm:w-44">
        <SelectValue placeholder={allLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
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
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          type="search"
          aria-label="Search products"
          placeholder="Search title or SKU"
          className="sm:max-w-xs"
          value={searchText}
          onChange={(event) => onSearchTextChange(event.target.value)}
        />
        <FilterSelect
          label="Category"
          allLabel="All categories"
          value={category}
          options={categories.map((item) => ({ value: item.id, label: item.title }))}
          onChange={(value) => onChange({ category: value })}
        />
        <FilterSelect
          label="Supplier"
          allLabel="All suppliers"
          value={supplier}
          options={suppliers.map((item) => ({ value: item.id, label: item.name }))}
          onChange={(value) => onChange({ supplier: value })}
        />
        <FilterSelect
          label="Stock status"
          allLabel="All stock statuses"
          value={status}
          options={STATUS_OPTIONS}
          onChange={(value) => onChange({ status: value })}
        />
      </div>
      {(canShowArchived || canClear) && (
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
              <Label htmlFor="show-archived">Show archived</Label>
            </div>
          )}
          {canClear && (
            <Button variant="outline" size="sm" onClick={onClear}>
              Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
