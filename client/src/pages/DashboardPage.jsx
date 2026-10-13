import { useMe } from '@/lib/auth';

export function DashboardPage() {
  const { data: user } = useMe();

  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-muted-foreground">
        Welcome, {user?.name}. Inventory figures appear here in a later milestone.
      </p>
    </section>
  );
}
