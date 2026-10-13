import { zodResolver } from '@hookform/resolvers/zod';
import { emailSchema, forgotPasswordSchema } from '@inventory/shared/schemas';
import { useForm } from 'react-hook-form';
import { Link, useLocation } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { ResendEmailButton } from '@/components/auth/ResendEmailButton';
import { FormAlert } from '@/components/form/FormAlert';
import { TextField } from '@/components/form/TextField';
import { Button } from '@/components/ui/button';
import { useForgotPassword } from '@/lib/auth';
import { applyFieldErrors, errorMessage } from '@/lib/errors';

const backToLogin = (
  <Link to="/login" className="underline">
    Back to log in
  </Link>
);

export function ForgotPasswordPage() {
  const location = useLocation();
  const forgot = useForgotPassword();

  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    // Pre-filled from the Login page's "Forgot password?" link.
    defaultValues: { email: location.state?.email ?? '' },
  });

  const onSubmit = ({ email }) =>
    forgot.mutate(email, { onError: (error) => applyFieldErrors(error, setError, ['email']) });

  if (forgot.isSuccess) {
    // The parsed (trimmed, lowercased) email is what the server used.
    const email = emailSchema.parse(getValues('email'));
    return (
      <AuthLayout title="Check your email" footer={backToLogin}>
        <div className="flex flex-col gap-4 text-sm">
          <p>
            If <strong>{email}</strong> belongs to an account that can reset its password, we sent
            it a link. Open it to choose a new password.
          </p>
          <p className="text-muted-foreground">
            The link expires in 30 minutes and works once. Check your spam folder if it doesn’t
            arrive.
          </p>
          <ResendEmailButton
            mutation={forgot}
            email={email}
            sentMessage="If the account can reset its password, a new link is on its way."
          />
        </div>
      </AuthLayout>
    );
  }

  const formError = forgot.error && !forgot.error.errors ? errorMessage(forgot.error) : null;

  return (
    <AuthLayout
      title="Forgot password"
      description="Enter your email and we will send you a link to choose a new password."
      footer={backToLogin}
    >
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormAlert>{formError}</FormAlert>
        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email}
          {...register('email')}
        />
        <Button type="submit" disabled={forgot.isPending}>
          {forgot.isPending ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </AuthLayout>
  );
}
