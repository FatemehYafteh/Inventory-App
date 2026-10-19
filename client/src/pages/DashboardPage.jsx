import { PageHeader } from '@/components/layout/PageHeader';
import { useMe } from '@/lib/auth';

export function DashboardPage() {
  const { data: user } = useMe();

  return (
    <section className="flex flex-col gap-2">
      <PageHeader
        title="Dashboard"
        description={`Welcome, ${user?.name ?? ''}. Inventory figures appear here in a later milestone.`}
      />
    </section>
  );
}
