import { Badge } from '@/components/ui/badge';

// Status names from the API, mapped to a badge colour and its default text. The text is always
// shown: status must never be conveyed by colour alone. `inactive` and `archived` use the
// outline badge because Badge has no neutral variant.
const STATUSES = {
  active: { variant: 'success', label: 'Active' },
  in_stock: { variant: 'success', label: 'In stock' },
  pending: { variant: 'warning', label: 'Pending' },
  low_stock: { variant: 'warning', label: 'Low stock' },
  rejected: { variant: 'danger', label: 'Rejected' },
  out_of_stock: { variant: 'danger', label: 'Out of stock' },
  inactive: { variant: 'outline', label: 'Inactive' },
  archived: { variant: 'outline', label: 'Archived' },
};

/** A status as a coloured badge. `label` overrides the text; an unknown status shows as is. */
export function StatusBadge({ status, label, ...props }) {
  const known = STATUSES[status];
  return (
    <Badge variant={known?.variant ?? 'outline'} {...props}>
      {label ?? known?.label ?? status}
    </Badge>
  );
}
