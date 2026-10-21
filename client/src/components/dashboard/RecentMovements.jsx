import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatDateTime, formatNumber } from '@/lib/format';

/** The last few movements as a list; the full, filterable table is the Movements page. */
export function RecentMovements({ items }) {
  const { t } = useTranslation();
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t('dashboard.recent.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('dashboard.recent.description')}</p>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t('dashboard.recent.empty')}
        </p>
      ) : (
        <ul className="flex flex-col divide-y">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-1 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-medium [overflow-wrap:anywhere]">
                  {item.product?.title}{' '}
                  <span className="text-xs font-normal text-muted-foreground">
                    {item.product?.sku}
                  </span>
                </span>
                {/* The sign is part of the text, so direction never depends on colour. */}
                <span className="tabular-nums">
                  {item.quantityChange > 0
                    ? t('movements.plus', { n: formatNumber(item.quantityChange) })
                    : t('movements.minus', { n: formatNumber(Math.abs(item.quantityChange)) })}
                </span>
              </div>
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
            </li>
          ))}
        </ul>
      )}
      <Link
        to="/movements"
        className="text-sm text-primary-text underline-offset-4 hover:underline"
      >
        {t('dashboard.recent.viewAll')}
      </Link>
    </Card>
  );
}
