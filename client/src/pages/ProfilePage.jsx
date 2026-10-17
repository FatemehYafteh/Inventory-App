import { updateProfileSchema } from '@inventory/shared/schemas';
import { ConnectTelegram } from '@/components/auth/TelegramSignIn';
import { FormAlert } from '@/components/form/FormAlert';
import { TextField } from '@/components/form/TextField';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCountdown } from '@/hooks/useCountdown';
import { useZodForm } from '@/hooks/useZodForm';
import { useForgotPassword, useMe, useUpdateProfile } from '@/lib/auth';
import { applyFieldErrors, errorMessage } from '@/lib/errors';

const RESET_COOLDOWN_SECONDS = 60;

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
    <section aria-labelledby="sign-in-methods" className="flex flex-col gap-3 text-sm">
      <h2 id="sign-in-methods" className="font-medium">
        Sign-in methods
      </h2>
      <dl className="grid grid-cols-[6rem_1fr] gap-x-4 gap-y-3">
        <dt className="text-muted-foreground">Email</dt>
        <dd className="flex flex-wrap items-center gap-2">
          <span>{user.email}</span>
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
    </section>
  );
}

/** Password changes only go through the reset-by-email flow. */
function PasswordReset({ email }) {
  const forgotPassword = useForgotPassword();
  const [secondsLeft, startCooldown] = useCountdown(0);

  const onClick = () =>
    forgotPassword.mutate(email, { onSuccess: () => startCooldown(RESET_COOLDOWN_SECONDS) });

  return (
    <section aria-labelledby="password" className="flex flex-col items-start gap-3 text-sm">
      <h2 id="password" className="font-medium">
        Password
      </h2>
      <p className="text-muted-foreground">To set or change your password, we email you a link.</p>
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
    </section>
  );
}

/** Profile for pending and active users: name, sign-in methods and password reset. */
export function ProfilePage() {
  const { data: user } = useMe();
  // The route guard only renders this page for a signed-in user with a complete profile.
  if (!user) return null;

  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your name and the ways you sign in.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-8">
        <NameForm user={user} />
        <SignInMethods user={user} />
        <PasswordReset email={user.email} />
      </CardContent>
    </Card>
  );
}
