import { Link, NavLink, Outlet } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLogout, useMe } from '@/lib/auth';
import { usePendingCount } from '@/lib/users';
import { cn } from '@/lib/utils';

// Pages are added here as their milestones land. `adminOnly` items are hidden from staff.
const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/users', label: 'Users', adminOnly: true, badge: true },
];

export function AppLayout() {
  const { data: user } = useMe();
  const logout = useLogout();
  const isAdmin = user?.role === 'admin';
  const { data: pendingCount = 0 } = usePendingCount({ enabled: isAdmin });
  const items = NAV_ITEMS.filter((item) => isAdmin || !item.adminOnly);

  return (
    <div className="min-h-svh">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <span className="font-semibold">Inventory</span>
          <nav aria-label="Main" className="flex flex-1 gap-1">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent',
                    isActive && 'bg-accent font-medium',
                  )
                }
              >
                {item.label}
                {item.badge && pendingCount > 0 && (
                  <Badge className="ml-2">
                    {pendingCount}
                    <span className="sr-only"> waiting for approval</span>
                  </Badge>
                )}
              </NavLink>
            ))}
          </nav>
          <Link
            to="/profile"
            className="hidden text-sm text-muted-foreground hover:underline sm:inline"
          >
            {user?.name}
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            Log out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
