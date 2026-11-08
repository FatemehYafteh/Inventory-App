// How each on-demand page is loaded. App.jsx wraps these in React.lazy; the test helper calls
// them all once up front, so a test never waits for a page's first import.
export const pageLoaders = {
  AwaitingApprovalPage: () => import('@/pages/AwaitingApprovalPage'),
  CompleteProfilePage: () => import('@/pages/CompleteProfilePage'),
  CategoriesPage: () => import('@/pages/CategoriesPage'),
  ConfirmLinkPage: () => import('@/pages/ConfirmLinkPage'),
  DashboardPage: () => import('@/pages/DashboardPage'),
  ForgotPasswordPage: () => import('@/pages/ForgotPasswordPage'),
  MovementsPage: () => import('@/pages/MovementsPage'),
  ProfilePage: () => import('@/pages/ProfilePage'),
  RegisterPage: () => import('@/pages/RegisterPage'),
  ResetPasswordPage: () => import('@/pages/ResetPasswordPage'),
  ProductsPage: () => import('@/pages/ProductsPage'),
  SuppliersPage: () => import('@/pages/SuppliersPage'),
  UsersPage: () => import('@/pages/UsersPage'),
  VerifyEmailPage: () => import('@/pages/VerifyEmailPage'),
};
