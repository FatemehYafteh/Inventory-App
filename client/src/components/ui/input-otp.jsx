import { OTPInput, OTPInputContext } from 'input-otp';
import { MinusIcon } from 'lucide-react';
import { forwardRef, useContext } from 'react';
import { cn } from '@/lib/utils';

// Keyboard-accessible one-time code input (Telegram login, sub-PRD 03).
const InputOTP = forwardRef(function InputOTP({ className, containerClassName, ...props }, ref) {
  return (
    <OTPInput
      ref={ref}
      containerClassName={cn('flex items-center gap-2 has-disabled:opacity-50', containerClassName)}
      className={cn('disabled:cursor-not-allowed', className)}
      {...props}
    />
  );
});

function InputOTPGroup({ className, ...props }) {
  return <div className={cn('flex items-center', className)} {...props} />;
}

function InputOTPSlot({ index, className, ...props }) {
  const { slots } = useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = slots[index] ?? {};

  return (
    <div
      data-active={isActive}
      className={cn(
        'relative flex h-10 w-10 items-center justify-center border-y border-r border-input text-base shadow-xs transition-all first:rounded-l-md first:border-l last:rounded-r-md data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-[3px] data-[active=true]:ring-ring',
        className,
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-pulse bg-foreground" />
        </div>
      )}
    </div>
  );
}

function InputOTPSeparator(props) {
  return (
    <div role="separator" {...props}>
      <MinusIcon className="size-4" aria-hidden="true" />
    </div>
  );
}

export { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot };
