import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatNumber } from '@/lib/format';

const linkClass = 'text-sm text-primary-text underline-offset-4 hover:underline';

/**
 * Products that are out of stock or low, lowest stock first, each with a Receive action.
 * `lowStockCount` and `outOfStockCount` decide which "view all" links show.
 */
export function LowStockList({ items, lowStockCount, outOfStockCount, onReceive }) {
  const { t } = useTranslation();
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t('dashboard.lowStock.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('dashboard.lowStock.description')}</p>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t('dashboard.lowStock.empty')}
        </p>
      ) : (
        <ul className="flex flex-col divide-y">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
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
      {(lowStockCount > 0 || outOfStockCount > 0) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
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
        </div>
      )}
    </Card>
  );
}
