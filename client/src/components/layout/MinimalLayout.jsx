import { useRef } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { useLogout } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { SkipLink, sidebarButtonClass } from './SidebarNav';

/** For pending users: no app navigation, only a way back to Awaiting approval. */
export function MinimalLayout() {
  const logout = useLogout();
  const mainRef = useRef(null);

  return (
    <div className="min-h-svh bg-muted/40">
      <SkipLink targetRef={mainRef} />
      <header className="bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-4 px-4">
          <span className="font-semibold">Inventory</span>
          <Link
            to="/awaiting-approval"
            className="flex-1 rounded-sm text-sm underline focus-visible:ring-[3px] focus-visible:ring-sidebar-ring focus-visible:outline-none"
          >
            Back to Awaiting approval
          </Link>
          <LanguageSwitcher tone="sidebar" />
          <Button
            variant="outline"
            size="sm"
            className={cn(sidebarButtonClass)}
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            Log out
          </Button>
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
