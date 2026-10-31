import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatNumber } from '@/lib/format';
import { LIST_ITEM_HIGHLIGHT } from '@/lib/highlight';

const linkClass = 'text-sm text-primary-text underline-offset-4 hover:underline';

/** Rows shown in the card; the rest are reached through "View all". */
export const LOW_STOCK_ROWS = 5;

/**
 * Products that are out of stock or low, lowest stock first, each with a Receive action.
 * Shows at most LOW_STOCK_ROWS rows; `lowStockCount` and `outOfStockCount` decide which
 * "view all" links show. The card fills its grid cell so it matches its neighbour in height.
 */
export function LowStockList({ items, lowStockCount, outOfStockCount, onReceive }) {
  const { t } = useTranslation();
  const rows = items.slice(0, LOW_STOCK_ROWS);
  const hidden = items.length - rows.length;
  return (
    <Card className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t('dashboard.lowStock.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('dashboard.lowStock.description')}</p>
      </div>
      {rows.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-6 text-center text-sm text-muted-foreground">
          {t('dashboard.lowStock.empty')}
        </p>
      ) : (
        <ul className="flex flex-1 flex-col divide-y">
          {rows.map((item) => (
            <li
              key={item.id}
              className={`flex flex-wrap items-center gap-3 py-3 ${LIST_ITEM_HIGHLIGHT}`}
            >
              <span
                aria-hidden="true"
                className="w-10 shrink-0 text-end text-xl font-semibold tabular-nums"
              >
                {formatNumber(item.quantity)}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-medium [overflow-wrap:anywhere]">{item.title}</span>
                <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  {item.sku}
                </span>
                <span className="text-sm text-muted-foreground">
                  {t('dashboard.lowStock.units', {
                    quantity: formatNumber(item.quantity),
                    level: formatNumber(item.reorderLevel),
                  })}
                </span>
              </div>
              <StatusBadge status={item.stockStatus} />
              <Button
                variant="outline"
                size="sm"
                aria-label={t('dashboard.lowStock.receiveLabel', { title: item.title })}
                onClick={() => onReceive(item)}
              >
                {t('dashboard.lowStock.receive')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1">
        {lowStockCount > 0 && (
          <Link to="/products?status=low_stock" className={linkClass}>
            {t('dashboard.lowStock.viewLow')}
          </Link>
        )}
        {outOfStockCount > 0 && (
          <Link to="/products?status=out_of_stock" className={linkClass}>
            {t('dashboard.lowStock.viewOut')}
          </Link>
        )}
        {hidden > 0 && (
          <span className="ms-auto text-sm text-muted-foreground">
            {t('dashboard.lowStock.more', { n: formatNumber(hidden) })}
          </span>
        )}
      </div>
    </Card>
  );
}
