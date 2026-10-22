import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/form/FormAlert';
import { useCountdown } from '@/hooks/useCountdown';
import { errorMessage } from '@/lib/errors';
import { formatNumber } from '@/lib/format';

export const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Sends an email again through `mutation` (called with the email), with the same 60 s
 * cooldown the server enforces.
 */
export function ResendEmailButton({
  mutation,
  email,
  sentMessage,
  initialCooldown = RESEND_COOLDOWN_SECONDS,
}) {
  const { t } = useTranslation();
  const [secondsLeft, startCooldown] = useCountdown(initialCooldown);

  const onClick = () =>
    mutation.mutate(email, { onSuccess: () => startCooldown(RESEND_COOLDOWN_SECONDS) });

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={onClick}
        disabled={secondsLeft > 0 || mutation.isPending}
      >
        {mutation.isPending
          ? t('auth.common.sending')
          : secondsLeft > 0
            ? t('auth.resend.resendEmailIn', { n: formatNumber(secondsLeft) })
            : t('auth.resend.resendEmail')}
      </Button>
      {mutation.isSuccess && secondsLeft > 0 && <FormAlert tone="success">{sentMessage}</FormAlert>}
      <FormAlert>{errorMessage(mutation.error)}</FormAlert>
    </div>
  );
}
