import { Brand } from '@/components/Brand';
import {
  ArrowLeftRightIcon,
  LayoutDashboardIcon,
  MenuIcon,
  PackageIcon,
  TagsIcon,
  TruckIcon,
  UsersIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router-dom';
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
  { to: '/', labelKey: 'layout.nav.dashboard', icon: LayoutDashboardIcon, end: true },
  { to: '/products', labelKey: 'layout.nav.products', icon: PackageIcon },
  { to: '/movements', labelKey: 'layout.nav.movements', icon: ArrowLeftRightIcon },
  { to: '/categories', labelKey: 'layout.nav.categories', icon: TagsIcon },
  { to: '/suppliers', labelKey: 'layout.nav.suppliers', icon: TruckIcon },
  { to: '/users', labelKey: 'layout.nav.users', icon: UsersIcon, adminOnly: true, badge: true },
];

/** Navy sidebar from `lg` up; below that a navy top bar whose menu opens the same navigation. */
export function AppLayout() {
  const { t } = useTranslation();
  const { data: user } = useMe();
  const logout = useLogout();
  const isAdmin = user?.role === 'admin';
  const { data: pendingCount = 0 } = usePendingCount({ enabled: isAdmin });
  const items = NAV_ITEMS.filter((item) => isAdmin || !item.adminOnly);
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef(null);
  const { pathname } = useLocation();
  const firstPath = useRef(pathname);

  // After moving to another page, keyboard and screen-reader users start at its heading (h1s
  // are focusable by code) instead of staying on the link they used. Not on first load.
  useEffect(() => {
    if (firstPath.current === pathname) return;
    firstPath.current = null;
    const main = mainRef.current;
    if (!main || main.contains(document.activeElement)) return;
    (main.querySelector('h1') ?? main).focus({ preventScroll: false });
  }, [pathname]);

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
      {/* In dark the navy is as dark as the page, so a dark-only edge keeps the sidebar visible. */}
      <aside className="sticky top-0 hidden h-svh bg-sidebar text-sidebar-foreground lg:flex lg:flex-col dark:border-e dark:border-sidebar-accent">
        <SidebarNav {...navProps} />
      </aside>
      <div className="min-w-0">
        <header className="flex h-14 items-center gap-3 bg-sidebar px-4 text-sidebar-foreground lg:hidden dark:border-b dark:border-sidebar-accent">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label={t('layout.openMenu')}
                className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring"
              >
                <MenuIcon className="size-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-60 border-sidebar-accent bg-sidebar p-0 text-sidebar-foreground sm:max-w-60"
            >
              <SheetTitle className="sr-only">{t('layout.menu')}</SheetTitle>
              <SheetDescription className="sr-only">{t('layout.mainNavigation')}</SheetDescription>
              <SidebarNav {...navProps} onNavigate={() => setMenuOpen(false)} />
            </SheetContent>
          </Sheet>
          <Brand />
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
