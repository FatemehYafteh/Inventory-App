import { Link, NavLink } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// On the navy surface the page's blue ring is too faint, so focus uses the sidebar ring token.
const focusRing =
  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring';

/** Navy-surface Log out button, shared by the sidebar, the mobile menu and the minimal bar. */
export const sidebarButtonClass =
  'border-sidebar-accent bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring';

/** First focusable element: jumps past the navigation to the page content. */
export function SkipLink({ targetRef }) {
  return (
    <a
      href="#main"
      onClick={(event) => {
        event.preventDefault();
        targetRef.current?.focus();
      }}
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:ring-[3px] focus:ring-ring focus:outline-none"
    >
      Skip to main content
    </a>
  );
}

/**
 * Brand, navigation and account area. The desktop sidebar and the mobile menu both render
 * it, so they cannot drift apart. `onNavigate` lets the mobile menu close itself.
 */
export function SidebarNav({ items, pendingCount, user, onLogout, logoutPending, onNavigate }) {
  return (
    <div className="flex h-full flex-1 flex-col gap-6 p-4">
      <span className="px-3 text-lg font-semibold">Inventory</span>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md border-l-2 border-transparent px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                focusRing,
                isActive &&
                  'border-sidebar-ring bg-sidebar-accent font-medium text-sidebar-accent-foreground',
              )
            }
          >
            <item.icon className="size-4 shrink-0" aria-hidden="true" />
            {item.label}
            {item.badge && pendingCount > 0 && (
              <Badge className="ml-auto">
                {pendingCount}
                <span className="sr-only"> waiting for approval</span>
              </Badge>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="flex flex-col gap-2 border-t border-sidebar-accent pt-4">
        <Link
          to="/profile"
          onClick={onNavigate}
          className={cn(
            'truncate rounded-sm px-3 text-sm text-sidebar-muted hover:text-sidebar-foreground hover:underline',
            focusRing,
          )}
        >
          {user?.name}
        </Link>
        <Button
          variant="outline"
          size="sm"
          className={cn('justify-start', sidebarButtonClass)}
          onClick={onLogout}
          disabled={logoutPending}
        >
          Log out
        </Button>
      </div>
    </div>
  );
}
