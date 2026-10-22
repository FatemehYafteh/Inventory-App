import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { useMe } from '@/lib/auth';

export function DashboardPage() {
  const { t } = useTranslation();
  const { data: user } = useMe();

  return (
    <section className="flex flex-col gap-2">
      <PageHeader
        title={t('layout.dashboard.title')}
        description={t('layout.dashboard.description', { name: user?.name ?? '' })}
      />
    </section>
  );
}
