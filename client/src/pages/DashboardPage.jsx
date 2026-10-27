import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormAlert } from '@/components/form/FormAlert';
import { LowStockList } from '@/components/dashboard/LowStockList';
import { RecentMovements } from '@/components/dashboard/RecentMovements';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { PageHeader } from '@/components/layout/PageHeader';
import { StockAdjustDialog } from '@/components/products/StockAdjustDialog';
import { useReturnFocus } from '@/hooks/useReturnFocus';
import { useMe } from '@/lib/auth';
import { useDashboard } from '@/lib/dashboard';
import { errorMessage } from '@/lib/errors';
import { useChangeStock } from '@/lib/products';
import { usePendingCount } from '@/lib/users';

/**
 * Stock at a glance: the summary cards, the products to restock (each with a Receive action that
 * opens the stock dialog) and the latest movements. Admins also see how many users wait for
 * approval. Archived products are not counted; the API decides what each role may see.
 */
export function DashboardPage() {
  const { t } = useTranslation();
  const { data: user } = useMe();
  const isAdmin = user?.role === 'admin';
  const dashboard = useDashboard();
  const pending = usePendingCount({ enabled: isAdmin });
  const changeStock = useChangeStock();

  const headingRef = useRef(null);
  const { remember, onCloseAutoFocus } = useReturnFocus(headingRef);
  // The id, not the row: the dialog reads the live product, so its quantity stays right.
  const [receivingId, setReceivingId] = useState(null);
  const receiving = dashboard.data?.lowStock.find((item) => item.id === receivingId);

  return (
    <section className="flex flex-col gap-4">
      <PageHeader
        ref={headingRef}
        title={t('layout.dashboard.title')}
        description={t('layout.dashboard.description', { name: user?.name ?? '' })}
      />
      {dashboard.error && <FormAlert>{errorMessage(dashboard.error)}</FormAlert>}
      {dashboard.isPending && !dashboard.error && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('dashboard.loading')}
        </p>
      )}
      {dashboard.data && (
        <>
          <SummaryCards
            summary={dashboard.data.summary}
            pending={isAdmin ? (pending.data ?? 0) : undefined}
          />
          <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
            <LowStockList
              items={dashboard.data.lowStock}
              lowStockCount={dashboard.data.summary.lowStockCount}
              outOfStockCount={dashboard.data.summary.outOfStockCount}
              onReceive={(item) => {
                remember();
                setReceivingId(item.id);
              }}
            />
            <RecentMovements items={dashboard.data.recentMovements} />
          </div>
        </>
      )}
      {receiving && (
        <StockAdjustDialog
          key={receiving.id}
          product={receiving}
          onCancel={() => setReceivingId(null)}
          onCloseAutoFocus={onCloseAutoFocus}
          onSubmit={async (values) => {
            await changeStock.mutateAsync({ id: receiving.id, ...values });
            setReceivingId(null);
          }}
        />
      )}
    </section>
  );
}
