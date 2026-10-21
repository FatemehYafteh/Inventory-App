import i18n from '@/i18n';

/** A user-facing message for an API error that is not tied to a form field. */
export function errorMessage(error) {
  if (!error) return null;
  if (error.status === 429) return i18n.t('common.tooManyAttempts');
  if (error.status >= 500 || !error.status) return i18n.t('common.somethingWrong');
  return error.message;
}

/** Puts server field errors ({ field: message }) on the matching React Hook Form fields. */
export function applyFieldErrors(error, setError, fields) {
  for (const [field, message] of Object.entries(error?.errors ?? {})) {
    if (fields.includes(field)) setError(field, { message });
  }
}
