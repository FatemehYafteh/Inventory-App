import { cn } from '@/lib/utils';

const TONES = {
  error: 'border-danger/30 bg-danger-soft text-danger',
  success: 'border-success/30 bg-success-soft text-success',
};

export function FormAlert({ tone = 'error', children }) {
  if (!children) return null;
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('rounded-md border px-3 py-2 text-sm', TONES[tone])}
    >
      {children}
    </p>
  );
}
