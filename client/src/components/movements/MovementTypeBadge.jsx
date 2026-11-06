import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

// Stock in is a positive (success) badge, stock out a negative (danger) one, and an adjustment
// is neutral. The text is always shown, so the kind never depends on colour alone.
const VARIANTS = {
  receive: 'success',
  increment: 'success',
  ship: 'danger',
  decrement: 'danger',
  adjust: 'outline',
};

/** The movement type as a small badge, the same in the movements table, dashboard and history. */
export function MovementTypeBadge({ type }) {
  const { t } = useTranslation();
  return <Badge variant={VARIANTS[type] ?? 'outline'}>{t(`movements.types.${type}`)}</Badge>;
}
