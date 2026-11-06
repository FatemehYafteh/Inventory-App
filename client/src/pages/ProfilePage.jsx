import { updateProfileSchema } from '@inventory/shared/schemas';
import { LockIcon, MailIcon, SendIcon, UserIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ConnectTelegram } from '@/components/auth/TelegramSignIn';
import { FormAlert } from '@/components/form/FormAlert';
import { TextField } from '@/components/form/TextField';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { useCountdown } from '@/hooks/useCountdown';
import { useZodForm } from '@/hooks/useZodForm';
import { useForgotPassword, useMe, useUpdateProfile } from '@/lib/auth';
import { applyFieldErrors, errorMessage } from '@/lib/errors';
import { formatNumber } from '@/lib/format';
import { initials } from '@/lib/initials';

const RESET_COOLDOWN_SECONDS = 60;

/**
 * One row of the Account card. The title and a short description sit at the start (about a third
 * of the width from `md` up) and the value and its action at the end; on a small screen they
 * stack. Every row has the same padding, so the divider lines sit at an even rhythm.
 */
function AccountRow({ icon: Icon, title, description, children }) {
  return (
    <div className="grid gap-4 p-6 md:grid-cols-3 md:gap-6">
      <div className="flex min-w-0 gap-3">
        <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-col gap-1.5">
          <h3 className="text-sm font-medium leading-none">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex min-w-0 flex-col items-start gap-3 md:col-span-2 md:items-end">
        {children}
      </div>
    </div>
  );
}

function NameForm({ user }) {
  const { t } = useTranslation();
  const updateProfile = useUpdateProfile();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useZodForm(updateProfileSchema, { defaultValues: { name: user.name ?? '' } });

  const onSubmit = (values) =>
    updateProfile.mutate(values, {
      onError: (error) => applyFieldErrors(error, setError, ['name']),
    });

  const formError =
    updateProfile.error && !updateProfile.error.errors ? errorMessage(updateProfile.error) : null;

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex w-full flex-col gap-3">
      {updateProfile.isSuccess && <FormAlert tone="success">{t('profile.name.saved')}</FormAlert>}
      <FormAlert>{formError}</FormAlert>
      {/* The row already shows "Name" as its title, so the label is for screen readers only. */}
      <TextField
        id="name"
        label={t('profile.name.title')}
        hideLabel
        autoComplete="name"
        error={errors.name}
        {...register('name')}
      />
      <Button type="submit" className="self-start md:self-end" disabled={updateProfile.isPending}>
        {updateProfile.isPending ? t('profile.name.saving') : t('profile.name.save')}
      </Button>
    </form>
  );
}

function EmailValue({ user }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 md:justify-end">
      <span dir="ltr" className="text-sm font-medium [overflow-wrap:anywhere]">
        {user.email}
      </span>
      <StatusBadge
        status={user.emailVerified ? 'active' : 'pending'}
        label={user.emailVerified ? t('profile.signIn.verified') : t('profile.signIn.notVerified')}
      />
    </div>
  );
}

function TelegramValue({ user }) {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-2 md:justify-end">
        {user.telegramConnected && user.telegramUsername && (
          <span dir="ltr" className="text-sm font-medium [overflow-wrap:anywhere]">
            @{user.telegramUsername}
          </span>
        )}
        <StatusBadge
          status={user.telegramConnected ? 'active' : 'inactive'}
          label={
            user.telegramConnected
              ? t('profile.signIn.connected')
              : t('profile.signIn.notConnected')
          }
        />
      </div>
      {!user.telegramConnected && <ConnectTelegram />}
    </>
  );
}

/** Password changes only go through the reset-by-email flow. */
function PasswordReset({ email }) {
  const { t } = useTranslation();
  const forgotPassword = useForgotPassword();
  const [secondsLeft, startCooldown] = useCountdown(0);

  const onClick = () =>
    forgotPassword.mutate(email, { onSuccess: () => startCooldown(RESET_COOLDOWN_SECONDS) });

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={onClick}
        disabled={secondsLeft > 0 || forgotPassword.isPending}
      >
        {forgotPassword.isPending
          ? t('profile.password.sending')
          : secondsLeft > 0
            ? t('profile.password.sendAgainIn', { n: formatNumber(secondsLeft) })
            : t('profile.password.send')}
      </Button>
      {forgotPassword.isSuccess && (
        <FormAlert tone="success">{t('profile.password.checkEmail', { email })}</FormAlert>
      )}
      <FormAlert>{errorMessage(forgotPassword.error)}</FormAlert>
    </>
  );
}

/** Who is signed in, at a glance: avatar, name, email, role and account status. */
function IdentityCard({ user }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="flex min-w-0 items-center gap-4 p-6">
        <div
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground"
        >
          {initials(user.name || user.email)}
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="text-lg font-semibold leading-tight [overflow-wrap:anywhere]">
            {user.name || user.email}
          </p>
          {user.name && (
            <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{user.email}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              {t(`profile.roles.${user.role}`, { defaultValue: user.role })}
            </Badge>
            <StatusBadge status={user.status} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Profile for pending and active users: identity, then one Account card of settings rows. */
export function ProfilePage() {
  const { t } = useTranslation();
  const { data: user } = useMe();
  // The route guard only renders this page for a signed-in user with a complete profile.
  if (!user) return null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader title={t('profile.title')} description={t('profile.description')} />
      <IdentityCard user={user} />
      {/* CardTitle is an h1, so the card's title is an h2 here and the row titles are h3. */}
      <section aria-labelledby="account-heading">
        <Card>
          <CardHeader>
            <h2 id="account-heading" className="text-lg font-semibold leading-none">
              {t('profile.account.title')}
            </h2>
            <CardDescription>{t('profile.account.description')}</CardDescription>
          </CardHeader>
          <div className="divide-y border-t">
            <AccountRow
              icon={UserIcon}
              title={t('profile.name.title')}
              description={t('profile.name.description')}
            >
              <NameForm user={user} />
            </AccountRow>
            <AccountRow
              icon={MailIcon}
              title={t('profile.signIn.email')}
              description={t('profile.signIn.emailDescription')}
            >
              <EmailValue user={user} />
            </AccountRow>
            <AccountRow
              icon={SendIcon}
              title={t('profile.signIn.telegram')}
              description={t('profile.signIn.telegramDescription')}
            >
              <TelegramValue user={user} />
            </AccountRow>
            <AccountRow
              icon={LockIcon}
              title={t('profile.password.title')}
              description={t('profile.password.description')}
            >
              <PasswordReset email={user.email} />
            </AccountRow>
          </div>
        </Card>
      </section>
    </div>
  );
}
