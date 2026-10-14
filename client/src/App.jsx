import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  RequireActive,
  RequireGuest,
  RequireIncompleteProfile,
  RequirePending,
} from '@/lib/guards';
import { AwaitingApprovalPage } from '@/pages/AwaitingApprovalPage';
import { CompleteProfilePage } from '@/pages/CompleteProfilePage';
import { ConfirmLinkPage } from '@/pages/ConfirmLinkPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
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
      <Route element={<RequireActive />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
