import { Brand } from '@/components/Brand';
import { LogOutIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router-dom';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

// On the navy surface the page's blue ring is too faint, so focus uses the sidebar ring token.
const focusRing =
  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring';

/** Navy-surface Log out button, shared by the sidebar, the mobile menu and the minimal bar. */
export const sidebarButtonClass =
  'border-sidebar-accent bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring';

/** First letter of the first two words of the name (works for Persian too). */
function initials(name) {
  const letters = (name ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return letters.map((word) => Array.from(word)[0]).join('') || '?';
}

/** First focusable element: jumps past the navigation to the page content. */
export function SkipLink({ targetRef }) {
  const { t } = useTranslation();
  return (
    <a
      href="#main"
      onClick={(event) => {
        event.preventDefault();
        targetRef.current?.focus();
      }}
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:ring-[3px] focus:ring-ring focus:outline-none"
    >
      {t('layout.skipLink')}
    </a>
  );
}

/**
 * Brand, navigation and account area. The desktop sidebar and the mobile menu both render
 * it, so they cannot drift apart. `onNavigate` lets the mobile menu close itself.
 */
export function SidebarNav({ items, pendingCount, user, onLogout, logoutPending, onNavigate }) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-1 flex-col gap-6 p-4">
      <Brand className="px-3" nameClassName="text-lg" />
      <nav aria-label={t('layout.nav.main')} className="flex flex-1 flex-col gap-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md border-s-2 border-transparent px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                focusRing,
                isActive &&
                  'border-sidebar-ring bg-sidebar-accent font-medium text-sidebar-accent-foreground',
              )
            }
          >
            <item.icon className="size-4 shrink-0" aria-hidden="true" />
            {t(item.labelKey)}
            {item.badge && pendingCount > 0 && (
              <Badge className="ms-auto">
                {formatNumber(pendingCount)}
                <span className="sr-only">{t('layout.nav.waitingForApproval')}</span>
              </Badge>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="flex flex-col gap-2 border-t border-sidebar-accent pt-4">
        <div className="grid grid-cols-2 gap-2">
          <LanguageSwitcher tone="sidebar" />
          <ThemeSwitcher tone="sidebar" />
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/profile"
            onClick={onNavigate}
            className={cn(
              'flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 hover:bg-sidebar-accent',
              focusRing,
            )}
          >
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-medium text-sidebar-accent-foreground"
            >
              {initials(user?.name)}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-sidebar-foreground">
                {user?.name}
              </span>
              {user?.role && (
                <span className="truncate text-xs text-sidebar-muted">
                  {t(`common.role.${user.role}`)}
                </span>
              )}
            </span>
          </Link>
          <Button
            variant="outline"
            size="sm"
            className={cn('size-8 shrink-0 p-0', sidebarButtonClass)}
            onClick={onLogout}
            disabled={logoutPending}
            aria-label={t('layout.logOut')}
            title={t('layout.logOut')}
          >
            <LogOutIcon className="size-4 rtl:-scale-x-100" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
