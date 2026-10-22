import { resendVerificationSchema } from '@inventory/shared/schemas';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { RESEND_COOLDOWN_SECONDS } from '@/components/auth/ResendVerificationButton';
import { FormAlert } from '@/components/form/FormAlert';
import { TextField } from '@/components/form/TextField';
import { Button } from '@/components/ui/button';
import { useCountdown } from '@/hooks/useCountdown';
import { useZodForm } from '@/hooks/useZodForm';
import { useResendVerification, useVerifyEmail } from '@/lib/auth';
import { applyFieldErrors, errorMessage, translateNotice } from '@/lib/errors';
import { formatNumber } from '@/lib/format';

function BackToLogin() {
  const { t } = useTranslation();
  return (
    <Link to="/login" className="underline">
      {t('auth.common.backToLogin')}
    </Link>
  );
}

function ResendForm() {
  const { t } = useTranslation();
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
      {resend.isSuccess && <FormAlert tone="success">{t('auth.verify.resent')}</FormAlert>}
      <FormAlert>
        {resend.error && !resend.error.errors ? errorMessage(resend.error) : null}
      </FormAlert>
      <TextField
        id="email"
        label={t('auth.common.email')}
        type="email"
        autoComplete="email"
        error={errors.email}
        {...register('email')}
      />
      <Button type="submit" disabled={resend.isPending || secondsLeft > 0}>
        {resend.isPending
          ? t('auth.common.sending')
          : secondsLeft > 0
            ? t('auth.verify.sendAgainIn', { n: formatNumber(secondsLeft) })
            : t('auth.common.sendVerificationLink')}
      </Button>
    </form>
  );
}

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const verification = useVerifyEmail(token);

  if (token && verification.isPending) {
    return (
      <AuthLayout title={t('auth.verify.verifying')}>
        <p role="status" className="text-sm text-muted-foreground">
          {t('auth.verify.oneMoment')}
        </p>
      </AuthLayout>
    );
  }

  if (token && verification.isSuccess) {
    return (
      <AuthLayout title={t('auth.verify.verified')}>
        <div className="flex flex-col gap-4 text-sm">
          <FormAlert tone="success">{translateNotice(verification.data.message)}</FormAlert>
          <p className="text-muted-foreground">{t('auth.verify.adminWillReview')}</p>
          <Button asChild>
            <Link to="/login">{t('auth.common.logIn')}</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={token ? t('auth.common.linkNotValid') : t('auth.verify.title')}
      description={token ? t('auth.verify.invalidDescription') : t('auth.verify.description')}
      footer={<BackToLogin />}
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
