import { Banknote, Boxes, Clock, Package, PackageX, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { formatNumber, formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';

// Colours of the icon tile and, when the count is above zero, of the value. The label always
// says what the card is, so colour is never the only signal.
const TONES = {
  neutral: { tile: 'bg-muted text-muted-foreground', value: '' },
  warning: { tile: 'bg-warning-soft text-warning', value: 'text-warning' },
  danger: { tile: 'bg-danger-soft text-danger', value: 'text-danger' },
};

function SummaryCard({ label, value, Icon, tone = 'neutral', highlight = false, children }) {
  const colours = TONES[tone];
  return (
    // A list item, not a dl/dt/dd: the icon wrapper and the optional link inside the card are not
    // allowed between a dl and its terms, and a screen reader reads "Label, value" for the item.
    <li className="min-w-0">
      <Card className="flex h-full min-w-0 flex-col gap-1.5 p-3 sm:gap-2 sm:p-4">
        <div className="flex items-center gap-2">
          <span className={cn('shrink-0 rounded-md p-1 sm:p-1.5', colours.tile)}>
            <Icon className="size-3.5 sm:size-4" aria-hidden="true" />
          </span>
          <p className="min-w-0 text-xs text-muted-foreground sm:text-sm">{label}</p>
        </div>
        {/* `anywhere` lets a very large figure wrap inside the card instead of overflowing it. */}
        <p
          className={cn(
            'text-lg font-semibold leading-tight tabular-nums [overflow-wrap:anywhere] sm:text-2xl',
            highlight && colours.value,
          )}
        >
          {value}
        </p>
        {children}
      </Card>
    </li>
  );
}

/**
 * The figures of `summary` as cards. Admins also get the Pending approvals card (`pending` is
 * the count, or undefined for staff, who never see it). Six columns only from 2xl: at xl the
 * content area is too narrow for them.
 */
export function SummaryCards({ summary, pending }) {
  const { t } = useTranslation();
  return (
    <ul
      aria-label={t('dashboard.summaryLabel')}
      className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6"
    >
      <SummaryCard
        label={t('dashboard.cards.activeProducts')}
        value={formatNumber(summary.activeProducts)}
        Icon={Package}
      />
      <SummaryCard
        label={t('dashboard.cards.totalUnits')}
        value={formatNumber(summary.totalUnits)}
        Icon={Boxes}
      />
      <SummaryCard
        label={t('dashboard.cards.inventoryValue')}
        value={formatPrice(summary.inventoryValue)}
        Icon={Banknote}
      />
      <SummaryCard
        label={t('dashboard.cards.lowStock')}
        value={formatNumber(summary.lowStockCount)}
        Icon={TriangleAlert}
        tone="warning"
        highlight={summary.lowStockCount > 0}
      />
      <SummaryCard
        label={t('dashboard.cards.outOfStock')}
        value={formatNumber(summary.outOfStockCount)}
        Icon={PackageX}
        tone="danger"
        highlight={summary.outOfStockCount > 0}
      />
      {pending !== undefined && (
        <SummaryCard
          label={t('dashboard.cards.pendingApprovals')}
          value={formatNumber(pending)}
          Icon={Clock}
        >
          <Link
            to="/users?status=pending"
            className="text-sm text-primary-text underline-offset-4 hover:underline"
          >
            {t('dashboard.pending.review')}
          </Link>
        </SummaryCard>
      )}
    </ul>
  );
}
