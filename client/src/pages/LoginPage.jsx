import { loginSchema } from '@inventory/shared/schemas';
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
  const login = useLogin();
  const accessDenied = useAccessDenied();
  // Set by pages that send the user here, e.g. after a password reset.
  const notice = useLocation().state?.notice;

  const {
    register,
    handleSubmit,
    setError,
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
      title="Log in"
      description="Choose how you want to sign in."
      footer={
        <div className="flex flex-col gap-1">
          <span>
            New here?{' '}
            <Link to="/register" className="font-medium text-foreground underline">
              Create an account
            </Link>
          </span>
          <Link to="/verify-email" className="underline">
            Didn’t get the verification email?
          </Link>
        </div>
      }
    >
      <AuthMethodTabs
        email={
          <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            {!login.error && <FormAlert tone="success">{notice}</FormAlert>}
            <FormAlert>{formError ?? (accessDenied ? 'Access denied.' : undefined)}</FormAlert>
            <TextField
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              error={errors.email}
              {...register('email')}
            />
            <TextField
              id="password"
              label="Password"
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
              Forgot password?
            </Link>
            <Button type="submit" disabled={login.isPending}>
              {login.isPending ? 'Logging in…' : 'Log in'}
            </Button>
          </form>
        }
      />
    </AuthLayout>
  );
}
