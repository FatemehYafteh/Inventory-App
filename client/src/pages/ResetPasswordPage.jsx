import { newPasswordSchema } from '@inventory/shared/schemas';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { FormAlert } from '@/components/form/FormAlert';
import { TextField } from '@/components/form/TextField';
import { Button } from '@/components/ui/button';
import { useZodForm } from '@/hooks/useZodForm';
import i18n from '@/i18n';
import { useResetPassword } from '@/lib/auth';
import { applyFieldErrors, errorMessage } from '@/lib/errors';

const FIELDS = ['password', 'confirmPassword'];

function BackToLogin() {
  const { t } = useTranslation();
  return (
    <Link to="/login" className="underline">
      {t('auth.common.backToLogin')}
    </Link>
  );
}

function InvalidLink() {
  const { t } = useTranslation();
  return (
    <AuthLayout
      title={t('auth.common.linkNotValid')}
      description={t('auth.reset.invalidDescription')}
      footer={<BackToLogin />}
    >
      <Button asChild>
        <Link to="/forgot-password">{t('auth.reset.requestNewLink')}</Link>
      </Button>
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const { t } = useTranslation();
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
    getValues,
    trigger,
    formState: { errors },
  } = useZodForm(newPasswordSchema, {
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = (values) =>
    reset.mutate(
      { token, ...values },
      {
        onSuccess: () =>
          navigate('/login', {
            replace: true,
            state: { notice: i18n.t('auth.reset.changedNotice') },
          }),
        onError: (error) => applyFieldErrors(error, setError, FIELDS),
      },
    );

  if (!token || reset.error?.code === 'INVALID_TOKEN') return <InvalidLink />;

  const formError = reset.error && !reset.error.errors ? errorMessage(reset.error) : null;

  return (
    <AuthLayout
      title={t('auth.reset.title')}
      description={t('auth.reset.description')}
      footer={<BackToLogin />}
    >
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormAlert>{formError}</FormAlert>
        <TextField
          id="password"
          label={t('auth.reset.newPassword')}
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
          label={t('auth.reset.confirmNewPassword')}
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword}
          {...register('confirmPassword')}
        />
        <Button type="submit" disabled={reset.isPending}>
          {reset.isPending ? t('auth.reset.submitting') : t('auth.reset.submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}
