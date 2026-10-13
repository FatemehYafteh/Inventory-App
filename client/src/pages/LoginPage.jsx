import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@inventory/shared/schemas';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { FormAlert } from '@/components/form/FormAlert';
import { TextField } from '@/components/form/TextField';
import { Button } from '@/components/ui/button';
import { useLogin } from '@/lib/auth';
import { applyFieldErrors, errorMessage } from '@/lib/errors';

export function LoginPage() {
  const login = useLogin();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

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
      description="Sign in with your email and password."
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
        <TextField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password}
          {...register('password')}
        />
        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
    </AuthLayout>
  );
}
