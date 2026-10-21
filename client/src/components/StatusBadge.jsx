import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

// Status names from the API, mapped to a badge colour and its default text. The text is always
// shown: status must never be conveyed by colour alone. `inactive` and `archived` use the
// outline badge because Badge has no neutral variant.
const STATUSES = {
  active: { variant: 'success', labelKey: 'common.status.active' },
  in_stock: { variant: 'success', labelKey: 'common.status.inStock' },
  pending: { variant: 'warning', labelKey: 'common.status.pending' },
  low_stock: { variant: 'warning', labelKey: 'common.status.lowStock' },
  rejected: { variant: 'danger', labelKey: 'common.status.rejected' },
  out_of_stock: { variant: 'danger', labelKey: 'common.status.outOfStock' },
  inactive: { variant: 'outline', labelKey: 'common.status.inactive' },
  archived: { variant: 'outline', labelKey: 'common.status.archived' },
};

/** A status as a coloured badge. `label` overrides the text; an unknown status shows as is. */
export function StatusBadge({ status, label, ...props }) {
  const { t } = useTranslation();
  const known = STATUSES[status];
  return (
    <Badge variant={known?.variant ?? 'outline'} {...props}>
      {label ?? (known ? t(known.labelKey) : status)}
    </Badge>
  );
}
