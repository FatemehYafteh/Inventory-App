import { zodResolver } from '@hookform/resolvers/zod';
import { newPasswordSchema } from '@inventory/shared/schemas';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { FormAlert } from '@/components/form/FormAlert';
import { TextField } from '@/components/form/TextField';
import { Button } from '@/components/ui/button';
import { useResetPassword } from '@/lib/auth';
import { applyFieldErrors, errorMessage } from '@/lib/errors';

const FIELDS = ['password', 'confirmPassword'];

export const PASSWORD_CHANGED_NOTICE = 'Password changed. Log in with your new password.';

const backToLogin = (
  <Link to="/login" className="underline">
    Back to log in
  </Link>
);

function InvalidLink() {
  return (
    <AuthLayout
      title="Link not valid"
      description="This reset link is invalid, expired or already used. Request a new one."
      footer={backToLogin}
    >
      <Button asChild>
        <Link to="/forgot-password">Request a new link</Link>
      </Button>
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Kept in state so the token can be removed from the address bar (and browser history).
  const [token] = useState(() => searchParams.get('token'));
  const reset = useResetPassword();

  useEffect(() => {
    if (searchParams.has('token')) setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = (values) =>
    reset.mutate(
      { token, ...values },
      {
        onSuccess: () =>
          navigate('/login', { replace: true, state: { notice: PASSWORD_CHANGED_NOTICE } }),
        onError: (error) => applyFieldErrors(error, setError, FIELDS),
      },
    );

  if (!token || reset.error?.code === 'INVALID_TOKEN') return <InvalidLink />;

  const formError = reset.error && !reset.error.errors ? errorMessage(reset.error) : null;

  return (
    <AuthLayout
      title="Choose a new password"
      description="After you save it, you will be logged out on every device."
      footer={backToLogin}
    >
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormAlert>{formError}</FormAlert>
        <TextField
          id="password"
          label="New password"
          type="password"
          autoComplete="new-password"
          error={errors.password}
          {...register('password')}
        />
        <p className="-mt-2 text-xs text-muted-foreground">
          At least 10 characters. Avoid common passwords.
        </p>
        <TextField
          id="confirmPassword"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword}
          {...register('confirmPassword')}
        />
        <Button type="submit" disabled={reset.isPending}>
          {reset.isPending ? 'Saving…' : 'Save new password'}
        </Button>
      </form>
    </AuthLayout>
  );
}
