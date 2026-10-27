import { emailSchema, forgotPasswordSchema } from '@inventory/shared/schemas';
import { Trans, useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { ResendEmailButton } from '@/components/auth/ResendEmailButton';
import { FormAlert } from '@/components/form/FormAlert';
import { TextField } from '@/components/form/TextField';
import { Button } from '@/components/ui/button';
import { useZodForm } from '@/hooks/useZodForm';
import { useForgotPassword } from '@/lib/auth';
import { applyFieldErrors, errorMessage } from '@/lib/errors';

function BackToLogin() {
  const { t } = useTranslation();
  return (
    <Link to="/login" className="underline">
      {t('auth.common.backToLogin')}
    </Link>
  );
}

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const forgot = useForgotPassword();

  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors },
  } = useZodForm(forgotPasswordSchema, {
    // Pre-filled from the Login page's "Forgot password?" link.
    defaultValues: { email: location.state?.email ?? '' },
  });

  const onSubmit = ({ email }) =>
    forgot.mutate(email, { onError: (error) => applyFieldErrors(error, setError, ['email']) });

  if (forgot.isSuccess) {
    // The parsed (trimmed, lowercased) email is what the server used.
    const email = emailSchema.parse(getValues('email'));
    return (
      <AuthLayout title={t('auth.common.checkYourEmail')} footer={<BackToLogin />}>
        <div className="flex flex-col gap-4 text-sm">
          <p>
            <Trans
              i18nKey="auth.forgot.sentLink"
              values={{ email }}
              components={{ strong: <strong /> }}
            />
          </p>
          <p className="text-muted-foreground">{t('auth.forgot.linkExpires')}</p>
          <ResendEmailButton
            mutation={forgot}
            email={email}
            sentMessage={t('auth.forgot.resent')}
          />
        </div>
      </AuthLayout>
    );
  }

  const formError = forgot.error && !forgot.error.errors ? errorMessage(forgot.error) : null;

  return (
    <AuthLayout
      title={t('auth.forgot.title')}
      description={t('auth.forgot.description')}
      footer={<BackToLogin />}
    >
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormAlert>{formError}</FormAlert>
        <TextField
          id="email"
          label={t('auth.common.email')}
          type="email"
          autoComplete="email"
          error={errors.email}
          {...register('email')}
        />
        <Button type="submit" disabled={forgot.isPending}>
          {forgot.isPending ? t('auth.common.sending') : t('auth.forgot.submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}
