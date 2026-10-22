import { emailSchema, registerSchema } from '@inventory/shared/schemas';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { AuthMethodTabs } from '@/components/auth/AuthMethodTabs';
import { ResendVerificationButton } from '@/components/auth/ResendVerificationButton';
import { FormAlert } from '@/components/form/FormAlert';
import { TextField } from '@/components/form/TextField';
import { Button } from '@/components/ui/button';
import { useZodForm } from '@/hooks/useZodForm';
import i18n from '@/i18n';
import { useRegister } from '@/lib/auth';
import { applyFieldErrors, errorMessage } from '@/lib/errors';

const FIELDS = ['name', 'email', 'password', 'confirmPassword'];

function LoginLink() {
  const { t } = useTranslation();
  return (
    <span>
      {t('auth.register.haveAccount')}{' '}
      <Link to="/login" className="font-medium text-foreground underline">
        {t('auth.common.logIn')}
      </Link>
    </span>
  );
}

export function RegisterPage() {
  const { t } = useTranslation();
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
    // The language chosen before signing up goes with the request, for the verification email.
    registration.mutate(
      { ...values, language: i18n.language },
      {
        onError: (error) => applyFieldErrors(error, setError, FIELDS),
      },
    );
  };

  if (registration.isSuccess) {
    // The parsed (trimmed, lowercased) email is what the server used.
    const email = emailSchema.parse(getValues('email'));
    return (
      <AuthLayout title={t('auth.common.checkYourEmail')} footer={<LoginLink />}>
        <div className="flex flex-col gap-4 text-sm">
          <p>
            <Trans
              i18nKey="auth.register.sentLink"
              values={{ email }}
              components={{ strong: <strong /> }}
            />
          </p>
          <p className="text-muted-foreground">{t('auth.register.linkExpires')}</p>
          <ResendVerificationButton email={email} />
        </div>
      </AuthLayout>
    );
  }

  const formError =
    registration.error && !registration.error.errors ? errorMessage(registration.error) : null;

  return (
    <AuthLayout
      title={t('auth.register.title')}
      description={t('auth.register.description')}
      footer={<LoginLink />}
    >
      <AuthMethodTabs
        email={
          <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormAlert>{formError}</FormAlert>
            <TextField
              id="name"
              label={t('auth.common.name')}
              autoComplete="name"
              error={errors.name}
              {...register('name')}
            />
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
              autoComplete="new-password"
              error={errors.password}
              {...register('password', {
                // Keep the confirmation's match error current once it has a value.
                onChange: () => getValues('confirmPassword') && trigger('confirmPassword'),
              })}
            />
            <p className="-mt-2 text-xs text-muted-foreground">{t('auth.common.passwordHint')}</p>
            <TextField
              id="confirmPassword"
              label={t('auth.register.confirmPassword')}
              type="password"
              autoComplete="new-password"
              error={errors.confirmPassword}
              {...register('confirmPassword')}
            />
            <Button type="submit" disabled={registration.isPending}>
              {registration.isPending ? t('auth.register.submitting') : t('auth.register.submit')}
            </Button>
          </form>
        }
      />
    </AuthLayout>
  );
}
