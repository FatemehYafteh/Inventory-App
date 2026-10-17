import { Link, Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLogout } from '@/lib/auth';

/** For pending users: no app navigation, only a way back to Awaiting approval. */
export function MinimalLayout() {
  const logout = useLogout();

  return (
    <div className="min-h-svh bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-4 px-4">
          <span className="font-semibold">Inventory</span>
          <Link to="/awaiting-approval" className="flex-1 text-sm underline">
            Back to Awaiting approval
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
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
