import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { MinimalLayout } from '@/components/layout/MinimalLayout';
import { homePathFor, useMe } from './auth';

function FullPageMessage({ children }) {
  return (
    <div className="flex min-h-svh items-center justify-center p-6 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function useSessionState() {
  const { t } = useTranslation();
  const { data: user, isPending, isError } = useMe();
  if (isPending) return { view: <FullPageMessage>{t('common.loading')}</FullPageMessage> };
  if (isError) {
    return {
      view: <FullPageMessage>{t('common.serverUnreachable')}</FullPageMessage>,
    };
  }
  return { user };
}

/** Signed-in, approved users only. Others go to login or the awaiting-approval screen. */
export function RequireActive() {
  const location = useLocation();
  const { user, view } = useSessionState();
  if (view) return view;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (homePathFor(user) !== '/') return <Navigate to={homePathFor(user)} replace />;
  return <Outlet />;
}

/**
 * Admin-only pages, inside RequireActive. Staff go to the dashboard; the API still answers
 * 403 to them, so this only keeps them from seeing a page that cannot work.
 */
export function RequireAdmin() {
  const { user, view } = useSessionState();
  if (view) return view;
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Signed-in pending users only. */
export function RequirePending() {
  const { user, view } = useSessionState();
  if (view) return view;
  if (!user) return <Navigate to="/login" replace />;
  if (homePathFor(user) !== '/awaiting-approval') {
    return <Navigate to={homePathFor(user)} replace />;
  }
  return <Outlet />;
}

/** Signed-in users whose profile is not complete yet (Telegram signups). */
export function RequireIncompleteProfile() {
  const { user, view } = useSessionState();
  if (view) return view;
  if (!user) return <Navigate to="/login" replace />;
  if (user.profileComplete) return <Navigate to={homePathFor(user)} replace />;
  return <Outlet />;
}

/**
 * Pages for any signed-in user with a complete profile (the Profile page): active users see
 * them in the app layout, pending users in a minimal layout without app navigation.
 */
export function RequireCompleteProfile() {
  const location = useLocation();
  const { user, view } = useSessionState();
  if (view) return view;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  const home = homePathFor(user);
  if (home === '/complete-profile') return <Navigate to={home} replace />;
  return home === '/' ? <AppLayout /> : <MinimalLayout />;
}

/**
 * Login and other public pages: signed-in users are sent on, back to the page that sent
 * them to login when there was one. This is also what moves the user on after logging in.
 */
export function RequireGuest() {
  const location = useLocation();
  const { user, view } = useSessionState();
  if (view) return view;
  if (user) {
    const from = location.state?.from;
    const target = user.status === 'active' && from ? from : homePathFor(user);
    return <Navigate to={target} replace />;
  }
  return <Outlet />;
}
