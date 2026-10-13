import { cn } from '@/lib/utils';

const TONES = {
  error: 'border-destructive/30 bg-destructive/5 text-destructive',
  success: 'border-emerald-600/30 bg-emerald-600/5 text-emerald-800',
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
