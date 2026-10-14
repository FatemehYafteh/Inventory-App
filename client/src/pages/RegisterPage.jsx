import { emailSchema, registerSchema } from '@inventory/shared/schemas';
import { Link } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { OrDivider } from '@/components/auth/OrDivider';
import { TelegramSignIn } from '@/components/auth/TelegramSignIn';
import { ResendVerificationButton } from '@/components/auth/ResendVerificationButton';
import { FormAlert } from '@/components/form/FormAlert';
import { TextField } from '@/components/form/TextField';
import { Button } from '@/components/ui/button';
import { useZodForm } from '@/hooks/useZodForm';
import { useRegister } from '@/lib/auth';
import { applyFieldErrors, errorMessage } from '@/lib/errors';

const FIELDS = ['name', 'email', 'password', 'confirmPassword'];

const loginLink = (
  <span>
    Already have an account?{' '}
    <Link to="/login" className="font-medium text-foreground underline">
      Log in
    </Link>
  </span>
);

export function RegisterPage() {
  const registration = useRegister();

  const {
    register,
    handleSubmit,
    setError,
    getValues,
    trigger,
    formState: { errors },
  } = useZodForm(registerSchema, {
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = (values) => {
    registration.mutate(values, {
      onError: (error) => applyFieldErrors(error, setError, FIELDS),
    });
  };

  if (registration.isSuccess) {
    // The parsed (trimmed, lowercased) email is what the server used.
    const email = emailSchema.parse(getValues('email'));
    return (
      <AuthLayout title="Check your email" footer={loginLink}>
        <div className="flex flex-col gap-4 text-sm">
          <p>
            We sent a verification link to <strong>{email}</strong>. Open it to confirm your
            address, then log in.
          </p>
          <p className="text-muted-foreground">
            The link expires in 24 hours. After you verify, an admin still needs to approve your
            account before you can use the app.
          </p>
          <ResendVerificationButton email={email} />
        </div>
      </AuthLayout>
    );
  }

  const formError =
    registration.error && !registration.error.errors ? errorMessage(registration.error) : null;

  return (
    <AuthLayout
      title="Create an account"
      description="Sign up with your email address."
      footer={loginLink}
    >
      <div className="mb-4 flex flex-col gap-4">
        <TelegramSignIn />
        <OrDivider />
      </div>
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormAlert>{formError}</FormAlert>
        <TextField
          id="name"
          label="Name"
          autoComplete="name"
          error={errors.name}
          {...register('name')}
        />
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
          autoComplete="new-password"
          error={errors.password}
          {...register('password', {
            // Keep the confirmation's match error current once it has a value.
            onChange: () => getValues('confirmPassword') && trigger('confirmPassword'),
          })}
        />
        <p className="-mt-2 text-xs text-muted-foreground">
          At least 10 characters. Avoid common passwords.
        </p>
        <TextField
          id="confirmPassword"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword}
          {...register('confirmPassword')}
        />
        <Button type="submit" disabled={registration.isPending}>
          {registration.isPending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
}
