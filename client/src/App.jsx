import { Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GlobalLoading } from '@/components/GlobalLoading';
import { PageMeta } from '@/components/PageMeta';
import { RouteFallback } from '@/components/RouteFallback';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  RequireActive,
  RequireAdmin,
  RequireCompleteProfile,
  RequireGuest,
  RequireIncompleteProfile,
  RequirePending,
} from '@/lib/guards';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { pageLoaders } from '@/pages/loaders';
import { DirectionProvider } from '@radix-ui/react-direction';
import { Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import '@/i18n';
import { directionOf } from '@/i18n';
import { useLanguageSync } from '@/i18n/useLanguage';
import { useThemeSync } from '@/theme/useTheme';

// Every page except the sign-in page (the usual first screen) and the 404 page loads on demand,
// so a visitor downloads the code of the page they open, not the whole app. The loaders are in
// pages/loaders.js.
const lazyPage = (name) =>
  lazy(() => pageLoaders[name]().then((module) => ({ default: module[name] })));
const AwaitingApprovalPage = lazyPage('AwaitingApprovalPage');
const CompleteProfilePage = lazyPage('CompleteProfilePage');
const CategoriesPage = lazyPage('CategoriesPage');
const ConfirmLinkPage = lazyPage('ConfirmLinkPage');
const DashboardPage = lazyPage('DashboardPage');
const ForgotPasswordPage = lazyPage('ForgotPasswordPage');
const MovementsPage = lazyPage('MovementsPage');
const ProfilePage = lazyPage('ProfilePage');
const RegisterPage = lazyPage('RegisterPage');
const ResetPasswordPage = lazyPage('ResetPasswordPage');
const ProductsPage = lazyPage('ProductsPage');
const SuppliersPage = lazyPage('SuppliersPage');
const UsersPage = lazyPage('UsersPage');
const VerifyEmailPage = lazyPage('VerifyEmailPage');

export function App() {
  useLanguageSync();
  useThemeSync();
  const { i18n } = useTranslation();
  return (
    // Radix primitives (menus, selects, tabs, dialogs) need the direction for keyboard and placement.
    <DirectionProvider dir={directionOf(i18n.language)}>
      <GlobalLoading />
      <PageMeta />
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route element={<RequireGuest />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>
            {/* Opened from an email link, whether or not the person is signed in. */}
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/confirm-link" element={<ConfirmLinkPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route element={<RequireIncompleteProfile />}>
              <Route path="/complete-profile" element={<CompleteProfilePage />} />
            </Route>
            <Route element={<RequirePending />}>
              <Route path="/awaiting-approval" element={<AwaitingApprovalPage />} />
            </Route>
            <Route element={<RequireCompleteProfile />}>
              <Route path="/profile" element={<ProfilePage />} />
            </Route>
            <Route element={<RequireActive />}>
              <Route element={<AppLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/movements" element={<MovementsPage />} />
                <Route path="/categories" element={<CategoriesPage />} />
                <Route path="/suppliers" element={<SuppliersPage />} />
                <Route element={<RequireAdmin />}>
                  <Route path="/users" element={<UsersPage />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </DirectionProvider>
  );
}
