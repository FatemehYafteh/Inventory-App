import { updateProfileSchema } from '@inventory/shared/schemas';
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
      {updateProfile.isSuccess && <FormAlert tone="success">Name saved.</FormAlert>}
      <FormAlert>{formError}</FormAlert>
      <TextField
        id="name"
        label="Name"
        autoComplete="name"
        error={errors.name}
        {...register('name')}
      />
      <Button type="submit" className="self-start" disabled={updateProfile.isPending}>
        {updateProfile.isPending ? 'Saving…' : 'Save name'}
      </Button>
    </form>
  );
}

function SignInMethods({ user }) {
  return (
    <dl className="flex flex-col gap-4 text-sm">
      <div className="flex min-w-0 flex-col gap-1.5">
        <dt className="text-muted-foreground">Email</dt>
        <dd className="flex min-w-0 flex-col items-start gap-1.5">
          <span className="font-medium [overflow-wrap:anywhere]">{user.email}</span>
          <StatusBadge
            status={user.emailVerified ? 'active' : 'pending'}
            label={user.emailVerified ? 'Verified' : 'Not verified'}
          />
        </dd>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <dt className="text-muted-foreground">Telegram</dt>
        <dd className="flex min-w-0 flex-col items-start gap-1.5">
          <StatusBadge
            status={user.telegramConnected ? 'active' : 'inactive'}
            label={user.telegramConnected ? 'Connected' : 'Not connected'}
          />
          {user.telegramConnected && user.telegramUsername && (
            <span className="font-medium [overflow-wrap:anywhere]">
              Connected as @{user.telegramUsername}
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
          ? 'Sending…'
          : secondsLeft > 0
            ? `Send again in ${secondsLeft}s`
            : 'Send password reset email'}
      </Button>
      {forgotPassword.isSuccess && (
        <FormAlert tone="success">Check {email} for a link to set a new password.</FormAlert>
      )}
      <FormAlert>{errorMessage(forgotPassword.error)}</FormAlert>
    </div>
  );
}

const ROLE_LABELS = { admin: 'Admin', staff: 'Staff' };

function initials(name, email) {
  const words = (name || email || '?').trim().split(/\s+/);
  const letters =
    words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0].slice(0, 2);
  return letters.toUpperCase();
}

/** Who is signed in, at a glance: avatar, name, email, role and account status. */
function IdentityCard({ user }) {
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
            <Badge variant="outline">{ROLE_LABELS[user.role] ?? user.role}</Badge>
            <StatusBadge status={user.status} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Profile for pending and active users: name, sign-in methods and password reset. */
export function ProfilePage() {
  const { data: user } = useMe();
  // The route guard only renders this page for a signed-in user with a complete profile.
  if (!user) return null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Profile" description="Your name and the ways you sign in." />
      <div className="flex w-full max-w-5xl flex-col gap-6">
        <IdentityCard user={user} />
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="flex min-w-0 flex-col gap-6">
            <ProfileSection
              id="name-heading"
              title="Name"
              description="How you appear in the app."
              region={false}
            >
              <NameForm user={user} />
            </ProfileSection>
            <ProfileSection
              id="password-heading"
              title="Password"
              description="To set or change your password, we email you a link."
            >
              <PasswordReset email={user.email} />
            </ProfileSection>
          </div>
          <ProfileSection
            id="sign-in-methods-heading"
            title="Sign-in methods"
            description="How you log in to this account."
          >
            <SignInMethods user={user} />
          </ProfileSection>
        </div>
      </div>
    </div>
  );
}
