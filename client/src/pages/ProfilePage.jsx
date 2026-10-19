import { updateProfileSchema } from '@inventory/shared/schemas';
import { ConnectTelegram } from '@/components/auth/TelegramSignIn';
import { FormAlert } from '@/components/form/FormAlert';
import { TextField } from '@/components/form/TextField';
import { PageHeader } from '@/components/layout/PageHeader';
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
    <Wrapper aria-labelledby={region ? id : undefined}>
      <Card>
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
  const telegram = user.telegramConnected
    ? user.telegramUsername
      ? `Connected as @${user.telegramUsername}`
      : 'Connected'
    : 'Not connected';

  return (
    <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
      <dt className="text-muted-foreground">Email</dt>
      <dd className="flex flex-wrap items-center gap-2">
        <span className="[overflow-wrap:anywhere]">{user.email}</span>
        <span className="text-muted-foreground">
          {user.emailVerified ? 'Verified' : 'Not verified'}
        </span>
      </dd>
      <dt className="text-muted-foreground">Telegram</dt>
      <dd className="flex flex-col items-stretch gap-2">
        <span>{telegram}</span>
        {!user.telegramConnected && <ConnectTelegram />}
      </dd>
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

/** Profile for pending and active users: name, sign-in methods and password reset. */
export function ProfilePage() {
  const { data: user } = useMe();
  // The route guard only renders this page for a signed-in user with a complete profile.
  if (!user) return null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Profile" description="Your name and the ways you sign in." />
      <div className="flex w-full max-w-3xl flex-col gap-6">
        <ProfileSection
          id="name-heading"
          title="Name"
          description="How you appear in the app."
          region={false}
        >
          <NameForm user={user} />
        </ProfileSection>
        <ProfileSection
          id="sign-in-methods-heading"
          title="Sign-in methods"
          description="How you log in to this account."
        >
          <SignInMethods user={user} />
        </ProfileSection>
        <ProfileSection
          id="password-heading"
          title="Password"
          description="To set or change your password, we email you a link."
        >
          <PasswordReset email={user.email} />
        </ProfileSection>
      </div>
    </div>
  );
}
