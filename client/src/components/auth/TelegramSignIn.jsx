import { telegramVerifySchema } from '@inventory/shared/schemas';
import { QRCodeSVG } from 'qrcode.react';
import { Controller } from 'react-hook-form';
import { FormAlert } from '@/components/form/FormAlert';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useSecondsUntil } from '@/hooks/useCountdown';
import { useZodForm } from '@/hooks/useZodForm';
import { errorMessage } from '@/lib/errors';
import {
  useTelegramConnectStart,
  useTelegramConnectVerify,
  useTelegramResend,
  useTelegramStart,
  useTelegramStatus,
  useTelegramVerify,
} from '@/lib/telegram';

const CODE_LENGTH = 6;
const codeSchema = telegramVerifySchema.pick({ otp: true });
// Server errors about the code itself belong on the code field, not in the page alert.
const CODE_ERRORS = new Set(['INVALID_CODE', 'TOO_MANY_ATTEMPTS', 'VALIDATION_ERROR']);
// Final statuses the page explains instead of offering a code form.
const REFUSALS = {
  refused: 'Access denied, contact an admin.',
  rate_limited: 'Too many codes requested. Try again in an hour.',
};

// The two uses of the deep-link + code flow differ only in endpoints and wording.
const FLOWS = {
  login: {
    useStart: useTelegramStart,
    useVerify: useTelegramVerify,
    startLabel: 'Continue with Telegram',
    expired: 'This sign-in link has expired.',
  },
  connect: {
    useStart: useTelegramConnectStart,
    useVerify: useTelegramConnectVerify,
    startLabel: 'Connect Telegram',
    expired: 'This link has expired.',
  },
};

/** "@username", or the display name when the Telegram account has no username. */
function telegramHandle({ telegramUsername, name }) {
  return telegramUsername ? `@${telegramUsername}` : name || 'you';
}

function CodeForm({ requestId, useVerify }) {
  const verify = useVerify();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useZodForm(codeSchema, { defaultValues: { otp: '' } });

  // On success the verify hook stores the user: sign-in moves on through the route guards,
  // Connect Telegram shows Telegram as connected.
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
/** "1:58" */
function minutesAndSeconds(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Asks Telegram for a new code, after the cooldown the server enforces. */
function ResendButton({ requestId, resendAt }) {
  const resend = useTelegramResend(requestId);
  const secondsLeft = useSecondsUntil(resendAt);

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={() => resend.mutate()}
        disabled={secondsLeft > 0 || resend.isPending}
      >
        {resend.isPending
          ? 'Sending…'
          : secondsLeft > 0
            ? `Send a new code in ${secondsLeft}s`
            : 'Send a new code'}
      </Button>
      <FormAlert>{errorMessage(resend.error)}</FormAlert>
    </div>
  );
}

/** The code sent to Telegram: entry form, expiry countdown and resend. */
function CodeStep({ requestId, status, useVerify }) {
  const codeSecondsLeft = useSecondsUntil(status.codeExpiresAt);
  const tooManyWrong = status.attemptsLeft === 0;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">We sent a code to {telegramHandle(status)} in Telegram</p>
      {tooManyWrong ? (
        <FormAlert>Too many wrong codes.</FormAlert>
      ) : codeSecondsLeft === 0 ? (
        <FormAlert>This code has expired.</FormAlert>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Code expires in {minutesAndSeconds(codeSecondsLeft)}
          </p>
          <CodeForm requestId={requestId} useVerify={useVerify} />
        </>
      )}
      <ResendButton requestId={requestId} resendAt={status.resendAt} />
    </div>
  );
}

/** Telegram sign-in on the Login and Register pages (sign-in and sign-up are one flow). */
export function TelegramSignIn() {
  return <TelegramFlow flow={FLOWS.login} />;
}

/** Connect Telegram on the Profile page: the same deep link and code, for the signed-in user. */
export function ConnectTelegram() {
  return <TelegramFlow flow={FLOWS.connect} />;
}

function TelegramFlow({ flow }) {
  const start = flow.useStart();
  const requestId = start.data?.requestId;
  const status = useTelegramStatus(requestId);
  const current = status.data?.status;

  if (!start.data) {
    return (
      <div className="flex flex-col gap-2">
        <FormAlert>{start.error && errorMessage(start.error)}</FormAlert>
        <Button type="button" onClick={() => start.mutate()} disabled={start.isPending}>
          {start.isPending ? 'Starting…' : flow.startLabel}
        </Button>
      </div>
    );
  }

  if (current === 'expired') {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm">{flow.expired}</p>
        <Button type="button" variant="outline" onClick={() => start.mutate()}>
          Start again
        </Button>
      </div>
    );
  }

  if (REFUSALS[current]) {
    return <FormAlert>{REFUSALS[current]}</FormAlert>;
  }

  if (current === 'otp_sent') {
    // Remount for each new code so the form starts empty (polls keep what was typed).
    return (
      <CodeStep
        key={status.data.codeSentAt}
        requestId={requestId}
        status={status.data}
        useVerify={flow.useVerify}
      />
    );
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
      {/* For people with Telegram only on their phone. */}
      <div data-qr className="hidden flex-col items-center gap-2 pt-2 md:flex">
        <QRCodeSVG
          value={start.data.deepLink}
          size={160}
          role="img"
          aria-label="QR code to open Telegram on your phone"
        />
        <p className="text-xs text-muted-foreground">Or scan with your phone camera.</p>
      </div>
    </div>
  );
}
