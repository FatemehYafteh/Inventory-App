import { resendVerificationSchema } from '@inventory/shared/schemas';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { RESEND_COOLDOWN_SECONDS } from '@/components/auth/ResendVerificationButton';
import { FormAlert } from '@/components/form/FormAlert';
import { TextField } from '@/components/form/TextField';
import { Button } from '@/components/ui/button';
import { useCountdown } from '@/hooks/useCountdown';
import { useZodForm } from '@/hooks/useZodForm';
import { useResendVerification, useVerifyEmail } from '@/lib/auth';
import { applyFieldErrors, errorMessage } from '@/lib/errors';

const backToLogin = (
  <Link to="/login" className="underline">
    Back to log in
  </Link>
);

function ResendForm() {
  const resend = useResendVerification();
  const [secondsLeft, startCooldown] = useCountdown(0);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useZodForm(resendVerificationSchema, { defaultValues: { email: '' } });

  const onSubmit = ({ email }) =>
    resend.mutate(email, {
      onSuccess: () => startCooldown(RESEND_COOLDOWN_SECONDS),
      onError: (error) => applyFieldErrors(error, setError, ['email']),
    });

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {resend.isSuccess && (
        <FormAlert tone="success">
          If that account needs verifying, a new link is on its way. Check your inbox.
        </FormAlert>
      )}
      <FormAlert>
        {resend.error && !resend.error.errors ? errorMessage(resend.error) : null}
      </FormAlert>
      <TextField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        error={errors.email}
        {...register('email')}
      />
      <Button type="submit" disabled={resend.isPending || secondsLeft > 0}>
        {resend.isPending
          ? 'Sending…'
          : secondsLeft > 0
            ? `Send again in ${secondsLeft}s`
            : 'Send verification link'}
      </Button>
    </form>
  );
}

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const verification = useVerifyEmail(token);

  if (token && verification.isPending) {
    return (
      <AuthLayout title="Verifying your email">
        <p role="status" className="text-sm text-muted-foreground">
          One moment…
        </p>
      </AuthLayout>
    );
  }

  if (token && verification.isSuccess) {
    return (
      <AuthLayout title="Email verified">
        <div className="flex flex-col gap-4 text-sm">
          <FormAlert tone="success">{verification.data.message}</FormAlert>
          <p className="text-muted-foreground">
            An admin will review your account. You can log in to check its status.
          </p>
          <Button asChild>
            <Link to="/login">Log in</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={token ? 'Link not valid' : 'Verify your email'}
      description={
        token
          ? 'This verification link is invalid, expired or already used. Enter your email to get a new one.'
          : 'Enter the email you signed up with and we will send a new verification link.'
      }
      footer={backToLogin}
    >
      {token && verification.error?.status >= 500 && (
        <div className="mb-4">
          <FormAlert>{errorMessage(verification.error)}</FormAlert>
        </div>
      )}
      <ResendForm />
    </AuthLayout>
  );
}
