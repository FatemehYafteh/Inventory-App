import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet } from 'react-router-dom';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { Button } from '@/components/ui/button';
import { useLogout } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { SkipLink, sidebarButtonClass } from './SidebarNav';

/** For pending users: no app navigation, only a way back to Awaiting approval. */
export function MinimalLayout() {
  const { t } = useTranslation();
  const logout = useLogout();
  const mainRef = useRef(null);

  return (
    <div className="min-h-svh bg-muted/40">
      <SkipLink targetRef={mainRef} />
      <header className="bg-sidebar text-sidebar-foreground dark:border-b dark:border-sidebar-accent">
        {/* The controls wrap onto a second line on a narrow screen instead of overflowing. */}
        <div className="mx-auto flex min-h-14 max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
          <span className="font-semibold">Inventory</span>
          <Link
            to="/awaiting-approval"
            className="min-w-32 flex-1 rounded-sm text-sm underline focus-visible:ring-[3px] focus-visible:ring-sidebar-ring focus-visible:outline-none"
          >
            {t('layout.backToAwaitingApproval')}
          </Link>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <ThemeSwitcher tone="sidebar" />
            <LanguageSwitcher tone="sidebar" />
            <Button
              variant="outline"
              size="sm"
              className={cn(sidebarButtonClass)}
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              {t('layout.logOut')}
            </Button>
          </div>
        </div>
      </header>
      <main
        id="main"
        ref={mainRef}
        tabIndex={-1}
        className="mx-auto max-w-3xl px-4 py-6 outline-none"
      >
        <Outlet />
      </main>
    </div>
  );
}
