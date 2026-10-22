import { updateProfileSchema } from '@inventory/shared/schemas';
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

const RESET_COOLDOWN_SECONDS = 60;

/**
 * One settings section: a titled card, inside a named region unless `region` is false (the Name
 * section: its field is already labelled "Name", so a region of the same name would be redundant).
 * CardTitle is an h1, so the title is an h2 here.
 */
function ProfileSection({ id, title, description, region = true, children }) {
  const Wrapper = region ? 'section' : 'div';
  return (
    <Wrapper aria-labelledby={region ? id : undefined} className="h-full">
      <Card className="h-full">
        <CardHeader>
          <h2 id={id} className="text-lg font-semibold leading-none">
            {title}
          </h2>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </Wrapper>
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
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {updateProfile.isSuccess && <FormAlert tone="success">{t('profile.name.saved')}</FormAlert>}
      <FormAlert>{formError}</FormAlert>
      <TextField
        id="name"
        label={t('profile.name.title')}
        autoComplete="name"
        error={errors.name}
        {...register('name')}
      />
      <Button type="submit" className="self-start" disabled={updateProfile.isPending}>
        {updateProfile.isPending ? t('profile.name.saving') : t('profile.name.save')}
      </Button>
    </form>
  );
}

function SignInMethods({ user }) {
  const { t } = useTranslation();
  return (
    <dl className="flex flex-col gap-4 text-sm">
      <div className="flex min-w-0 flex-col gap-1.5">
        <dt className="text-muted-foreground">{t('profile.signIn.email')}</dt>
        <dd className="flex min-w-0 flex-col items-start gap-1.5">
          <span className="font-medium [overflow-wrap:anywhere]">{user.email}</span>
          <StatusBadge
            status={user.emailVerified ? 'active' : 'pending'}
            label={
              user.emailVerified ? t('profile.signIn.verified') : t('profile.signIn.notVerified')
            }
          />
        </dd>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <dt className="text-muted-foreground">{t('profile.signIn.telegram')}</dt>
        <dd className="flex min-w-0 flex-col items-start gap-1.5">
          <StatusBadge
            status={user.telegramConnected ? 'active' : 'inactive'}
            label={
              user.telegramConnected
                ? t('profile.signIn.connected')
                : t('profile.signIn.notConnected')
            }
          />
          {user.telegramConnected && user.telegramUsername && (
            <span className="font-medium [overflow-wrap:anywhere]">
              {t('profile.signIn.connectedAs', { username: user.telegramUsername })}
            </span>
          )}
        </dd>
      </div>
      {!user.telegramConnected && <ConnectTelegram />}
    </dl>
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
    <div className="flex flex-col items-start gap-3 text-sm">
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
    </div>
  );
}

function initials(name, email) {
  const words = (name || email || '?').trim().split(/\s+/);
  const letters =
    words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0].slice(0, 2);
  return letters.toUpperCase();
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
          {initials(user.name, user.email)}
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

/** Profile for pending and active users: name, sign-in methods and password reset. */
export function ProfilePage() {
  const { t } = useTranslation();
  const { data: user } = useMe();
  // The route guard only renders this page for a signed-in user with a complete profile.
  if (!user) return null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('profile.title')} description={t('profile.description')} />
      <div className="flex w-full max-w-5xl flex-col gap-6">
        <IdentityCard user={user} />
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="flex min-w-0 flex-col gap-6">
            <ProfileSection
              id="name-heading"
              title={t('profile.name.title')}
              description={t('profile.name.description')}
              region={false}
            >
              <NameForm user={user} />
            </ProfileSection>
            <ProfileSection
              id="password-heading"
              title={t('profile.password.title')}
              description={t('profile.password.description')}
            >
              <PasswordReset email={user.email} />
            </ProfileSection>
          </div>
          <ProfileSection
            id="sign-in-methods-heading"
            title={t('profile.signIn.title')}
            description={t('profile.signIn.description')}
          >
            <SignInMethods user={user} />
          </ProfileSection>
        </div>
      </div>
    </div>
  );
}
