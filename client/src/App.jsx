import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  RequireActive,
  RequireAdmin,
  RequireCompleteProfile,
  RequireGuest,
  RequireIncompleteProfile,
  RequirePending,
} from '@/lib/guards';
import { AwaitingApprovalPage } from '@/pages/AwaitingApprovalPage';
import { CompleteProfilePage } from '@/pages/CompleteProfilePage';
import { CategoriesPage } from '@/pages/CategoriesPage';
import { ConfirmLinkPage } from '@/pages/ConfirmLinkPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { RegisterPage } from '@/pages/RegisterPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { ProductsPage } from '@/pages/ProductsPage';
import { SuppliersPage } from '@/pages/SuppliersPage';
import { UsersPage } from '@/pages/UsersPage';
import { VerifyEmailPage } from '@/pages/VerifyEmailPage';

export function App() {
  return (
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
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route element={<RequireAdmin />}>
            <Route path="/users" element={<UsersPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
