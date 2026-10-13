import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireActive, RequireGuest, RequirePending } from '@/lib/guards';
import { AwaitingApprovalPage } from '@/pages/AwaitingApprovalPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { RegisterPage } from '@/pages/RegisterPage';
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
