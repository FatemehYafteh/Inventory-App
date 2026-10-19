import { LayoutDashboardIcon, MenuIcon, TagsIcon, TruckIcon, UsersIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useLogout, useMe } from '@/lib/auth';
import { usePendingCount } from '@/lib/users';
import { SidebarNav, SkipLink } from './SidebarNav';

// Pages are added here as their milestones land. `adminOnly` items are hidden from staff.
const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboardIcon, end: true },
  { to: '/categories', label: 'Categories', icon: TagsIcon },
  { to: '/suppliers', label: 'Suppliers', icon: TruckIcon },
  { to: '/users', label: 'Users', icon: UsersIcon, adminOnly: true, badge: true },
];

/** Navy sidebar from `lg` up; below that a navy top bar whose menu opens the same navigation. */
export function AppLayout() {
  const { data: user } = useMe();
  const logout = useLogout();
  const isAdmin = user?.role === 'admin';
  const { data: pendingCount = 0 } = usePendingCount({ enabled: isAdmin });
  const items = NAV_ITEMS.filter((item) => isAdmin || !item.adminOnly);
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef(null);

  const navProps = {
    items,
    pendingCount,
    user,
    onLogout: () => logout.mutate(),
    logoutPending: logout.isPending,
  };

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[15rem_1fr]">
      <SkipLink targetRef={mainRef} />
      <aside className="sticky top-0 hidden h-svh bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
        <SidebarNav {...navProps} />
      </aside>
      <div className="min-w-0">
        <header className="flex h-14 items-center gap-3 bg-sidebar px-4 text-sidebar-foreground lg:hidden">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Open menu"
                className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring"
              >
                <MenuIcon className="size-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-60 border-sidebar-accent bg-sidebar p-0 text-sidebar-foreground sm:max-w-60"
            >
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <SheetDescription className="sr-only">Main navigation</SheetDescription>
              <SidebarNav {...navProps} onNavigate={() => setMenuOpen(false)} />
            </SheetContent>
          </Sheet>
          <span className="font-semibold">Inventory</span>
        </header>
        <main
          id="main"
          ref={mainRef}
          tabIndex={-1}
          className="mx-auto max-w-[90rem] px-4 py-6 outline-none"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
