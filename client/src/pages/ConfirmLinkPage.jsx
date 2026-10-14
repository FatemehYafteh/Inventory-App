import { accountLinkConfirmSchema } from '@inventory/shared/schemas';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { FormAlert } from '@/components/form/FormAlert';
import { TextField } from '@/components/form/TextField';
import { Button } from '@/components/ui/button';
import { useZodForm } from '@/hooks/useZodForm';
import { useConfirmAccountLink } from '@/lib/auth';
import { applyFieldErrors, errorMessage } from '@/lib/errors';

const passwordSchema = accountLinkConfirmSchema.pick({ password: true });

const backToLogin = (
  <Link to="/login" className="underline">
    Back to log in
  </Link>
);

function InvalidLink() {
  return (
    <AuthLayout
      title="Link not valid"
      description="This link is invalid, expired or already used, or the request it was for has changed. Nothing was linked."
      footer={backToLogin}
    />
  );
}

/**
 * Opened from the link-confirmation email (Account link): the owner of an email + password
 * account confirms with their password that a Telegram account may sign in to it.
 * Signs no one in.
 */
export function ConfirmLinkPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Kept in state so the token can be removed from the address bar (and browser history).
  const [token] = useState(() => searchParams.get('token'));
  const confirm = useConfirmAccountLink();

  useEffect(() => {
    if (searchParams.has('token')) setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useZodForm(passwordSchema, { defaultValues: { password: '' } });

  const onSubmit = ({ password }) =>
    confirm.mutate(
      { token, password },
      { onError: (error) => applyFieldErrors(error, setError, ['password']) },
    );

  if (!token || confirm.error?.code === 'INVALID_TOKEN') return <InvalidLink />;

  if (confirm.isSuccess) {
    return (
      <AuthLayout title="Account linked">
        <div className="flex flex-col gap-4 text-sm">
          <FormAlert tone="success">{confirm.data.message}</FormAlert>
          <Button asChild>
            <Link to="/login">Log in</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  const formError = confirm.error && !confirm.error.errors ? errorMessage(confirm.error) : null;

  return (
    <AuthLayout
      title="Confirm account link"
      description="A Telegram account asked to sign in to your account. If it was you, enter your account password to confirm. If not, close this page and nothing will change."
      footer={backToLogin}
    >
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormAlert>{formError}</FormAlert>
        <TextField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password}
          {...register('password')}
        />
        <Button type="submit" disabled={confirm.isPending}>
          {confirm.isPending ? 'Confirming…' : 'Confirm link'}
        </Button>
      </form>
    </AuthLayout>
  );
}
