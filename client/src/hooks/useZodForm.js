import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

/**
 * `useForm` validated by a Zod schema. Every form uses this so they all behave the same:
 * a field is first checked when the user leaves it, then rechecked on every change.
 */
export function useZodForm(schema, options) {
  return useForm({ mode: 'onTouched', resolver: zodResolver(schema), ...options });
}
