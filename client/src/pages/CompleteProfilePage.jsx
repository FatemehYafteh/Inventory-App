import { completeProfileSchema } from '@inventory/shared/schemas';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { RESEND_COOLDOWN_SECONDS, ResendEmailButton } from '@/components/auth/ResendEmailButton';
import { FormAlert } from '@/components/form/FormAlert';
import { TextField } from '@/components/form/TextField';
import { Button } from '@/components/ui/button';
import { useZodForm } from '@/hooks/useZodForm';
import { useCompleteProfile, useLogout, useMe, useResendProfileVerification } from '@/lib/auth';
import { applyFieldErrors, errorMessage } from '@/lib/errors';

// While an email waits for verification, /me is polled so the page moves on to Awaiting
// approval (through the route guard) even when the link is opened on another device.
const POLL_MS = 5000;

function LogoutButton() {
  const { t } = useTranslation();
  const logout = useLogout();
  return (
    <Button variant="ghost" onClick={() => logout.mutate()} disabled={logout.isPending}>
      {t('auth.common.logOut')}
    </Button>
  );
}

function ProfileForm({ user, onSent, onCancel }) {
  const { t } = useTranslation();
  const completeProfile = useCompleteProfile();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useZodForm(completeProfileSchema, {
    defaultValues: { name: user.name ?? '', email: '' },
  });

  const onSubmit = (values) =>
    completeProfile.mutate(values, {
      onSuccess: onSent,
      onError: (error) => applyFieldErrors(error, setError, ['name', 'email']),
    });

  const formError =
    completeProfile.error && !completeProfile.error.errors
      ? errorMessage(completeProfile.error)
      : null;

  return (
    <AuthLayout
      title={t('auth.completeProfile.title')}
      description={t('auth.completeProfile.description')}
    >
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
        <Button type="submit" disabled={completeProfile.isPending}>
          {completeProfile.isPending
            ? t('auth.common.sending')
            : t('auth.common.sendVerificationLink')}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('auth.completeProfile.backTo', { email: user.pendingEmail })}
          </Button>
        )}
        <LogoutButton />
      </form>
    </AuthLayout>
  );
}

function CheckEmail({ email, justSent, onChangeEmail }) {
  const { t } = useTranslation();
  const resend = useResendProfileVerification();

  return (
    <AuthLayout title={t('auth.common.checkYourEmail')}>
      <div className="flex flex-col gap-4 text-sm">
        <p>
          <Trans
            i18nKey="auth.completeProfile.sentLink"
            values={{ email }}
            components={{ strong: <strong /> }}
          />
        </p>
        <p className="text-muted-foreground">{t('auth.completeProfile.nothingArriving')}</p>
        <ResendEmailButton
          mutation={resend}
          sentMessage={t('auth.completeProfile.resent')}
          initialCooldown={justSent ? RESEND_COOLDOWN_SECONDS : 0}
        />
        <Button type="button" variant="outline" onClick={onChangeEmail}>
          {t('auth.completeProfile.useDifferentEmail')}
        </Button>
        <LogoutButton />
      </div>
    </AuthLayout>
  );
}

/** Telegram signups add a name and a verified email before an admin can approve them. */
export function CompleteProfilePage() {
  const { data: user } = useMe({
    refetchInterval: (query) => (query.state.data?.pendingEmail ? POLL_MS : false),
  });
  const [editing, setEditing] = useState(false);
  const [justSent, setJustSent] = useState(false);

  // The route guard only renders this page for a signed-in user with an incomplete profile.
  if (!user) return null;

  if (user.pendingEmail && !editing) {
    return (
      <CheckEmail
        key={user.pendingEmail}
        email={user.pendingEmail}
        justSent={justSent}
        onChangeEmail={() => setEditing(true)}
      />
    );
  }

  return (
    <ProfileForm
      user={user}
      onCancel={user.pendingEmail ? () => setEditing(false) : undefined}
      onSent={() => {
        setEditing(false);
        setJustSent(true);
      }}
    />
  );
}
