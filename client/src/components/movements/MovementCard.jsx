import { useTranslation } from 'react-i18next';
import { MovementTypeBadge } from '@/components/movements/MovementTypeBadge';
import { movementNote } from '@/components/movements/movementNote';
import { signedChange } from '@/components/movements/signedChange';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, formatNumber } from '@/lib/format';

const wrap = '[overflow-wrap:anywhere]';

/**
 * One stock movement as a card, for the movements table and the stock history dialog below `md`.
 * `showProduct` is off in the history dialog, where every movement is of the same product.
 */
export function MovementCard({ movement, showProduct = true }) {
  const { t } = useTranslation();
  const { product, supplier, performedBy } = movement;
  const note = movementNote(t, movement);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        {showProduct && (
          <div className={`flex min-w-0 flex-col gap-0.5 ${wrap}`}>
            {product ? (
              <>
                <span className="font-medium">
                  <bdi>{product.title}</bdi>
                </span>
                <span className="text-xs text-muted-foreground">
                  <bdi>{product.sku}</bdi>
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        )}
        <MovementTypeBadge type={movement.type} />
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 tabular-nums">
        <span className="text-lg font-semibold">{signedChange(t, movement.quantityChange)}</span>
        <span className="text-sm text-muted-foreground">
          {t('movements.beforeAfter', {
            before: formatNumber(movement.quantityBefore),
            after: formatNumber(movement.quantityAfter),
          })}
        </span>
      </div>
      {(note || supplier) && (
        <div className={`flex flex-col gap-0.5 text-sm ${wrap}`}>
          {note && (
            <span>
              <bdi>{note}</bdi>
            </span>
          )}
          {supplier && (
            <span className="text-xs text-muted-foreground">
              <bdi>{supplier.name}</bdi>
            </span>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <span className={wrap}>
          <bdi>{performedBy.name}</bdi>
        </span>
        {performedBy.role && (
          <Badge variant="secondary">{t(`users.role.${performedBy.role}`)}</Badge>
        )}
        <span aria-hidden="true">·</span>
        <span>{formatDateTime(movement.createdAt)}</span>
      </div>
    </div>
  );
}
