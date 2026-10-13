import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/form/FormAlert';
import { useCountdown } from '@/hooks/useCountdown';
import { useResendVerification } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';

export const RESEND_COOLDOWN_SECONDS = 60;

/** Resends the verification email, with the same 60 s cooldown the server enforces. */
export function ResendVerificationButton({ email, initialCooldown = RESEND_COOLDOWN_SECONDS }) {
  const [secondsLeft, startCooldown] = useCountdown(initialCooldown);
  const resend = useResendVerification();

  const onClick = () =>
    resend.mutate(email, { onSuccess: () => startCooldown(RESEND_COOLDOWN_SECONDS) });

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={onClick}
        disabled={secondsLeft > 0 || resend.isPending}
      >
        {resend.isPending
          ? 'Sending…'
          : secondsLeft > 0
            ? `Resend email in ${secondsLeft}s`
            : 'Resend email'}
      </Button>
      {resend.isSuccess && secondsLeft > 0 && (
        <FormAlert tone="success">We sent a new link if your account needs one.</FormAlert>
      )}
      <FormAlert>{errorMessage(resend.error)}</FormAlert>
    </div>
  );
}
