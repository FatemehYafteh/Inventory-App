import { NavLink, Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLogout, useMe } from '@/lib/auth';
import { cn } from '@/lib/utils';

// Pages are added here as their milestones land.
const NAV_ITEMS = [{ to: '/', label: 'Dashboard', end: true }];

export function AppLayout() {
  const { data: user } = useMe();
  const logout = useLogout();

  return (
    <div className="min-h-svh">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <span className="font-semibold">Inventory</span>
          <nav aria-label="Main" className="flex flex-1 gap-1">
            {NAV_ITEMS.map((item) => (
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
              </NavLink>
            ))}
          </nav>
          <span className="hidden text-sm text-muted-foreground sm:inline">{user?.name}</span>
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
