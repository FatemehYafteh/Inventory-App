import { accountLinkConfirmSchema } from '@inventory/shared/schemas';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { FormAlert } from '@/components/form/FormAlert';
import { TextField } from '@/components/form/TextField';
import { Button } from '@/components/ui/button';
import { useZodForm } from '@/hooks/useZodForm';
import { useConfirmAccountLink } from '@/lib/auth';
import { applyFieldErrors, errorMessage, translateNotice } from '@/lib/errors';

const passwordSchema = accountLinkConfirmSchema.pick({ password: true });

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
      description={t('auth.confirmLink.invalidDescription')}
      footer={<BackToLogin />}
    />
  );
}

/**
 * Opened from the link-confirmation email (Account link): the owner of an email + password
 * account confirms with their password that a Telegram account may sign in to it.
 * Signs no one in.
 */
export function ConfirmLinkPage() {
  const { t } = useTranslation();
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
      <AuthLayout title={t('auth.confirmLink.linked')}>
        <div className="flex flex-col gap-4 text-sm">
          <FormAlert tone="success">{translateNotice(confirm.data.message)}</FormAlert>
          <Button asChild>
            <Link to="/login">{t('auth.common.logIn')}</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  const formError = confirm.error && !confirm.error.errors ? errorMessage(confirm.error) : null;

  return (
    <AuthLayout
      title={t('auth.confirmLink.title')}
      description={t('auth.confirmLink.description')}
      footer={<BackToLogin />}
    >
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormAlert>{formError}</FormAlert>
        <TextField
          id="password"
          label={t('auth.common.password')}
          type="password"
          autoComplete="current-password"
          error={errors.password}
          {...register('password')}
        />
        <Button type="submit" disabled={confirm.isPending}>
          {confirm.isPending ? t('auth.confirmLink.submitting') : t('auth.confirmLink.submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}
