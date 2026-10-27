import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { formatNumber, formatPrice } from '@/lib/format';

function SummaryCard({ label, value, children }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
      {children}
    </Card>
  );
}

/**
 * The figures of `summary` as cards. Admins also get the Pending approvals card (`pending` is
 * the count, or undefined for staff, who never see it).
 */
export function SummaryCards({ summary, pending }) {
  const { t } = useTranslation();
  return (
    <dl
      aria-label={t('dashboard.summaryLabel')}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
    >
      <SummaryCard
        label={t('dashboard.cards.activeProducts')}
        value={formatNumber(summary.activeProducts)}
      />
      <SummaryCard
        label={t('dashboard.cards.totalUnits')}
        value={formatNumber(summary.totalUnits)}
      />
      <SummaryCard
        label={t('dashboard.cards.inventoryValue')}
        value={formatPrice(summary.inventoryValue)}
      />
      <SummaryCard
        label={t('dashboard.cards.lowStock')}
        value={formatNumber(summary.lowStockCount)}
      />
      <SummaryCard
        label={t('dashboard.cards.outOfStock')}
        value={formatNumber(summary.outOfStockCount)}
      />
      {pending !== undefined && (
        <SummaryCard label={t('dashboard.cards.pendingApprovals')} value={formatNumber(pending)}>
          <Link
            to="/users?status=pending"
            className="text-sm text-primary-text underline-offset-4 hover:underline"
          >
            {t('dashboard.pending.review')}
          </Link>
        </SummaryCard>
      )}
    </dl>
  );
}
