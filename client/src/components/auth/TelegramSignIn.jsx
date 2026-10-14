import { telegramVerifySchema } from '@inventory/shared/schemas';
import { Controller } from 'react-hook-form';
import { FormAlert } from '@/components/form/FormAlert';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useZodForm } from '@/hooks/useZodForm';
import { errorMessage } from '@/lib/errors';
import { useTelegramStart, useTelegramStatus, useTelegramVerify } from '@/lib/telegram';

const CODE_LENGTH = 6;
const codeSchema = telegramVerifySchema.pick({ otp: true });
// Server errors about the code itself belong on the code field, not in the page alert.
const CODE_ERRORS = new Set(['INVALID_CODE', 'VALIDATION_ERROR']);

/** "@username", or the display name when the Telegram account has no username. */
function telegramHandle({ telegramUsername, name }) {
  return telegramUsername ? `@${telegramUsername}` : name || 'you';
}

function CodeForm({ requestId, handle }) {
  const verify = useTelegramVerify();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useZodForm(codeSchema, { defaultValues: { otp: '' } });

  // On success useTelegramVerify stores the user, and the route guards move them on.
  const onSubmit = ({ otp }) => {
    verify.mutate(
      { requestId, otp },
      {
        onError: (error) => {
          if (CODE_ERRORS.has(error.code)) {
            setError('otp', { message: error.errors?.otp ?? error.message });
          }
        },
      },
    );
  };

  const formError =
    verify.error && !CODE_ERRORS.has(verify.error.code) ? errorMessage(verify.error) : null;

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
      <p className="text-sm">We sent a code to {handle} in Telegram</p>
      <FormAlert>{formError}</FormAlert>
      <Controller
        name="otp"
        control={control}
        render={({ field }) => (
          <InputOTP
            ref={field.ref}
            name={field.name}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            maxLength={CODE_LENGTH}
            inputMode="numeric"
            pattern="^[0-9]*$"
            autoComplete="one-time-code"
            aria-label="Code from Telegram"
            aria-invalid={Boolean(errors.otp)}
            aria-describedby={errors.otp ? 'otp-error' : undefined}
          >
            <InputOTPGroup>
              {Array.from({ length: CODE_LENGTH }, (_, index) => (
                <InputOTPSlot key={index} index={index} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        )}
      />
      {errors.otp && (
        <p id="otp-error" className="text-sm text-destructive">
          {errors.otp.message}
        </p>
      )}
      <Button type="submit" disabled={verify.isPending}>
        {verify.isPending ? 'Verifying…' : 'Verify'}
      </Button>
    </form>
  );
}
/** Telegram sign-in on the Login and Register pages (sign-in and sign-up are one flow). */
export function TelegramSignIn() {
  const start = useTelegramStart();
  const requestId = start.data?.requestId;
  const status = useTelegramStatus(requestId);
  const current = status.data?.status;

  if (!start.data) {
    return (
      <div className="flex flex-col gap-2">
        <FormAlert>{start.error && errorMessage(start.error)}</FormAlert>
        <Button type="button" onClick={() => start.mutate()} disabled={start.isPending}>
          {start.isPending ? 'Starting…' : 'Continue with Telegram'}
        </Button>
      </div>
    );
  }

  if (current === 'expired') {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm">This sign-in link has expired.</p>
        <Button type="button" variant="outline" onClick={() => start.mutate()}>
          Start again
        </Button>
      </div>
    );
  }

  if (current === 'otp_sent') {
    return <CodeForm requestId={requestId} handle={telegramHandle(status.data)} />;
  }

  return (
    <div className="flex flex-col gap-2">
      <Button asChild>
        <a href={start.data.deepLink} target="_blank" rel="noreferrer">
          Open Telegram
        </a>
      </Button>
      <p className="text-sm text-muted-foreground">
        Press Start in Telegram, then come back here for your code.
      </p>
    </div>
  );
}
