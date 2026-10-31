import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatDateTime, formatNumber } from '@/lib/format';
import { LIST_ITEM_HIGHLIGHT } from '@/lib/highlight';

/** Rows shown in the card; the full, filterable table is the Movements page. */
export const RECENT_MOVEMENT_ROWS = 5;

/**
 * The latest movements as a list, at most RECENT_MOVEMENT_ROWS of them. The card fills its
 * grid cell so it matches its neighbour in height, with the link pinned to the bottom.
 */
export function RecentMovements({ items }) {
  const { t } = useTranslation();
  const rows = items.slice(0, RECENT_MOVEMENT_ROWS);
  return (
    <Card className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t('dashboard.recent.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('dashboard.recent.description')}</p>
      </div>
      {rows.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-6 text-center text-sm text-muted-foreground">
          {t('dashboard.recent.empty')}
        </p>
      ) : (
        <ul className="flex flex-1 flex-col divide-y">
          {rows.map((item) => (
            <li key={item.id} className={`flex items-start gap-3 py-3 ${LIST_ITEM_HIGHLIGHT}`}>
              {/* The sign is part of the text, so direction never depends on colour. */}
              <span className="w-12 shrink-0 text-end text-lg font-semibold tabular-nums">
                {item.quantityChange > 0
                  ? t('movements.plus', { n: formatNumber(item.quantityChange) })
                  : t('movements.minus', { n: formatNumber(Math.abs(item.quantityChange)) })}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-medium [overflow-wrap:anywhere]">
                  {item.product?.title}{' '}
                  <span className="text-xs font-normal text-muted-foreground">
                    {item.product?.sku}
                  </span>
                </span>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  <span>{t(`movements.types.${item.type}`)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="[overflow-wrap:anywhere]">{item.performedBy.name}</span>
                  {item.performedBy.role && (
                    <Badge variant="secondary">{t(`users.role.${item.performedBy.role}`)}</Badge>
                  )}
                  <span aria-hidden="true">·</span>
                  <span className="whitespace-nowrap">{formatDateTime(item.createdAt)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Link
        to="/movements"
        className="mt-auto text-sm text-primary-text underline-offset-4 hover:underline"
      >
        {t('dashboard.recent.viewAll')}
      </Link>
    </Card>
  );
}
