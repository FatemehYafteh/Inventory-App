import { completeProfileSchema } from '@inventory/shared/schemas';
import { useState } from 'react';
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
  const logout = useLogout();
  return (
    <Button variant="ghost" onClick={() => logout.mutate()} disabled={logout.isPending}>
      Log out
    </Button>
  );
}

function ProfileForm({ user, onSent, onCancel }) {
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
      title="Complete your profile"
      description="Add your name and email. After you verify the email, an admin can approve your account."
    >
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormAlert>{formError}</FormAlert>
        <TextField
          id="name"
          label="Name"
          autoComplete="name"
          error={errors.name}
          {...register('name')}
        />
        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email}
          {...register('email')}
        />
        <Button type="submit" disabled={completeProfile.isPending}>
          {completeProfile.isPending ? 'Sending…' : 'Send verification link'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Back to {user.pendingEmail}
          </Button>
        )}
        <LogoutButton />
      </form>
    </AuthLayout>
  );
}

function CheckEmail({ email, justSent, onChangeEmail }) {
  const resend = useResendProfileVerification();

  return (
    <AuthLayout title="Check your email">
      <div className="flex flex-col gap-4 text-sm">
        <p>
          We sent a verification link to <strong>{email}</strong>. Open it to confirm your address;
          this page moves on by itself.
        </p>
        <p className="text-muted-foreground">
          Nothing arriving? Use a different email, or contact an admin.
        </p>
        <ResendEmailButton
          mutation={resend}
          sentMessage="If this email can be used, a new link is on its way."
          initialCooldown={justSent ? RESEND_COOLDOWN_SECONDS : 0}
        />
        <Button type="button" variant="outline" onClick={onChangeEmail}>
          Use a different email
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
