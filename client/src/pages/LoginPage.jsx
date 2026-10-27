import { loginSchema } from '@inventory/shared/schemas';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { AuthMethodTabs } from '@/components/auth/AuthMethodTabs';
import { FormAlert } from '@/components/form/FormAlert';
import { TextField } from '@/components/form/TextField';
import { Button } from '@/components/ui/button';
import { useZodForm } from '@/hooks/useZodForm';
import { useAccessDenied, useLogin } from '@/lib/auth';
import { applyFieldErrors, errorMessage } from '@/lib/errors';

export function LoginPage() {
  // Public demo account, shown only when the build sets both variables (see README).
  const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL;
  const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD;
  const { t } = useTranslation();
  const login = useLogin();
  const accessDenied = useAccessDenied();
  // Set by pages that send the user here, e.g. after a password reset.
  const notice = useLocation().state?.notice;

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useZodForm(loginSchema, { defaultValues: { email: '', password: '' } });

  // On success useLogin stores the user, and the RequireGuest route guard redirects.
  const onSubmit = (values) => {
    login.mutate(values, {
      onError: (error) => applyFieldErrors(error, setError, ['email', 'password']),
    });
  };

  const formError = login.error && !login.error.errors ? errorMessage(login.error) : null;

  return (
    <AuthLayout
      title={t('auth.login.title')}
      description={t('auth.login.description')}
      footer={
        <div className="flex flex-col gap-1">
          <span>
            {t('auth.login.newHere')}{' '}
            <Link to="/register" className="font-medium text-foreground underline">
              {t('auth.login.createAccount')}
            </Link>
          </span>
          <Link to="/verify-email" className="underline">
            {t('auth.login.noVerificationEmail')}
          </Link>
        </div>
      }
    >
      <AuthMethodTabs
        email={
          <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            {!login.error && <FormAlert tone="success">{notice}</FormAlert>}
            <FormAlert>
              {formError ?? (accessDenied ? t('auth.login.accessDenied') : undefined)}
            </FormAlert>
            {DEMO_EMAIL && DEMO_PASSWORD && (
              <section
                aria-labelledby="demo-account-title"
                className="flex flex-col gap-2 rounded-md border border-dashed px-3 py-2 text-sm"
              >
                <h2 id="demo-account-title" className="font-medium">
                  {t('auth.login.demo.title')}
                </h2>
                <p className="text-muted-foreground">{t('auth.login.demo.body')}</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <dt>{t('auth.common.email')}</dt>
                  <dd dir="ltr" className="font-mono">
                    {DEMO_EMAIL}
                  </dd>
                  <dt>{t('auth.common.password')}</dt>
                  <dd dir="ltr" className="font-mono">
                    {DEMO_PASSWORD}
                  </dd>
                </dl>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => {
                    setValue('email', DEMO_EMAIL, { shouldValidate: true });
                    setValue('password', DEMO_PASSWORD, { shouldValidate: true });
                  }}
                >
                  {t('auth.login.demo.fill')}
                </Button>
              </section>
            )}
            <TextField
              id="email"
              label={t('auth.common.email')}
              type="email"
              autoComplete="email"
              error={errors.email}
              {...register('email')}
            />
            <TextField
              id="password"
              label={t('auth.common.password')}
              type="password"
              autoComplete="current-password"
              error={errors.password}
              {...register('password')}
            />
            <Link
              to="/forgot-password"
              state={{ email: watch('email').trim() }}
              className="-mt-2 self-end text-sm underline"
            >
              {t('auth.login.forgotPassword')}
            </Link>
            <Button type="submit" disabled={login.isPending}>
              {login.isPending ? t('auth.login.submitting') : t('auth.common.logIn')}
            </Button>
          </form>
        }
      />
    </AuthLayout>
  );
}
