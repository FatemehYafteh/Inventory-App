import { codeForMessage } from '@inventory/shared/errorCodes';
import i18n from '@/i18n';

/**
 * The text for a message from the shared catalogue (a Zod message, or a server field error, which
 * is the same text) in the current language. Text the catalogue does not know, or has no
 * translation for, comes back unchanged, so nothing is ever hidden or shown as a raw key.
 */
export function translateMessage(text) {
  if (!text || i18n.language === 'en') return text;
  const code = codeForMessage(text);
  const key = `errors.messages.${code}`;
  return code && i18n.exists(key) ? i18n.t(key) : text;
}

/** The generic text for an API error code, or null (English keeps the server's own wording). */
function translateCode(code) {
  const key = `errors.codes.${code}`;
  return code && i18n.exists(key) ? i18n.t(key) : null;
}

// Success messages the server sends that the client shows as they are, mapped to their texts.
const NOTICE_KEYS = {
  'Email verified. Return to the app or log in.': 'auth.notices.emailVerified',
  'Your email is verified. You can now log in.': 'auth.notices.emailVerifiedLogIn',
  'Telegram is now connected to your account. Log in with Telegram or your email.':
    'auth.notices.telegramConnected',
};

/** A success message from the server in the current language; an unknown one is shown as sent. */
export function translateNotice(text) {
  const key = NOTICE_KEYS[text];
  return key && i18n.exists(key) ? i18n.t(key) : text;
}

/**
 * A user-facing message for an API error that is not tied to a form field. The order is: the
 * translated message code, the translated generic code, the server's English message. English
 * always shows the server's message, which is already specific (counts and names included).
 */
export function errorMessage(error) {
  if (!error) return null;
  if (error.status === 429) return i18n.t('common.tooManyAttempts');
  if (error.status >= 500 || !error.status) return i18n.t('common.somethingWrong');
  if (i18n.language === 'en') return error.message;
  const messageCode = error.messageCode ?? codeForMessage(error.message);
  const key = `errors.messages.${messageCode}`;
  if (messageCode && i18n.exists(key)) return i18n.t(key);
  return translateCode(error.code) ?? error.message;
}

/** Puts server field errors ({ field: message }) on the matching React Hook Form fields. */
export function applyFieldErrors(error, setError, fields) {
  for (const [field, message] of Object.entries(error?.errors ?? {})) {
    if (fields.includes(field)) setError(field, { message: translateMessage(message) });
  }
}
