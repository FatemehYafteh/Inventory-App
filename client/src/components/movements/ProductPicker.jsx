import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useProduct, useProducts } from '@/lib/products';
import { cn } from '@/lib/utils';

const RESULT_LIMIT = 20;

/** The matching products, searched on the server; only mounted while the list is open. */
function ProductOptions({ value, includeArchived, onSelect }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const products = useProducts({
    search: search.trim(),
    archived: includeArchived ? 'true' : undefined,
    sortBy: 'title',
    order: 'asc',
    page: 1,
    limit: RESULT_LIMIT,
  });
  const items = products.data?.items ?? [];

  return (
    // The server does the filtering, so cmdk must not filter the list a second time.
    <Command shouldFilter={false}>
      <CommandInput
        value={search}
        onValueChange={setSearch}
        placeholder={t('movements.filters.productSearch')}
      />
      <CommandList>
        {products.isPending && (
          <p role="status" className="py-6 text-center text-sm text-muted-foreground">
            {t('common.loading')}
          </p>
        )}
        {products.error && (
          <p role="alert" className="py-6 text-center text-sm text-danger">
            {t('common.somethingWrong')}
          </p>
        )}
        {!products.isPending && !products.error && items.length === 0 && (
          <CommandEmpty>{t('movements.filters.productNone')}</CommandEmpty>
        )}
        {items.map((item) => (
          <CommandItem
            key={item.id}
            value={item.id}
            onSelect={() => onSelect(item.id)}
            className="flex items-center gap-2"
          >
            <CheckIcon
              className={cn('size-4 shrink-0', value === item.id ? 'opacity-100' : 'opacity-0')}
              aria-hidden="true"
            />
            <span className="[overflow-wrap:anywhere]">
              {item.title} <span className="text-muted-foreground">({item.sku})</span>
            </span>
          </CommandItem>
        ))}
      </CommandList>
    </Command>
  );
}

/** A searchable product filter. Choosing the selected product again clears it. */
export function ProductPicker({ value, onChange, includeArchived }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const selected = useProduct(value);
  const label = selected.data?.product.title ?? (value ? t('common.loading') : null);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={t('movements.filters.product')}
          className="w-full justify-between sm:w-auto sm:min-w-52"
        >
          <span className="truncate">{label ?? t('movements.filters.allProducts')}</span>
          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <ProductOptions
          value={value}
          includeArchived={includeArchived}
          onSelect={(id) => {
            onChange(id === value ? '' : id);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
