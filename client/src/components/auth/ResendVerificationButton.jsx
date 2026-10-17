import { ResendEmailButton } from '@/components/auth/ResendEmailButton';
import { useResendVerification } from '@/lib/auth';

export { RESEND_COOLDOWN_SECONDS } from '@/components/auth/ResendEmailButton';

/** Resends the verification email, with the same 60 s cooldown the server enforces. */
export function ResendVerificationButton({ email, initialCooldown }) {
  const resend = useResendVerification();
  return (
    <ResendEmailButton
      mutation={resend}
      email={email}
      initialCooldown={initialCooldown}
      sentMessage="We sent a new link if your account needs one."
    />
  );
}
