import { z } from 'zod';
import { m } from '../errorCodes.js';
import { COMMON_PASSWORDS } from './common-passwords.js';

export const emailSchema = z
  .string({ required_error: m.EMAIL_REQUIRED })
  .trim()
  .toLowerCase()
  .min(1, m.EMAIL_REQUIRED)
  .max(254, m.EMAIL_TOO_LONG)
  .email(m.EMAIL_INVALID);

// Rules for setting a password (register, reset). Login only checks presence.
export const passwordSchema = z
  .string({ required_error: m.PASSWORD_REQUIRED })
  .min(10, m.PASSWORD_TOO_SHORT)
  .max(128, m.PASSWORD_TOO_LONG)
  .refine((value) => !COMMON_PASSWORDS.has(value.toLowerCase()), {
    message: m.PASSWORD_TOO_COMMON,
  });

/** The languages the app supports. */
export const LANGUAGES = ['en', 'fa'];

export const languageSchema = z.enum(LANGUAGES, { message: m.LANGUAGE_UNSUPPORTED });

export const nameSchema = z
  .string({ required_error: m.NAME_REQUIRED })
  .trim()
  .min(1, m.NAME_REQUIRED)
  .max(100, m.NAME_TOO_LONG_100);

/** One-time tokens from email links. */
export const tokenSchema = z
  .string({ required_error: m.TOKEN_REQUIRED })
  .trim()
  .min(1, m.TOKEN_REQUIRED)
  .max(200, m.TOKEN_INVALID);

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ required_error: m.PASSWORD_REQUIRED })
    .min(1, m.PASSWORD_REQUIRED)
    .max(128, m.PASSWORD_TOO_LONG),
});

export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string({ required_error: m.PASSWORD_CONFIRM_REQUIRED }),
    // The language the visitor chose before signing up; the verification email uses it.
    language: languageSchema.optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: m.PASSWORDS_DO_NOT_MATCH,
  });

export const verifyEmailSchema = z.object({ token: tokenSchema });

export const resendVerificationSchema = z.object({ email: emailSchema });

export const forgotPasswordSchema = z.object({ email: emailSchema });

const newPasswordFields = {
  password: passwordSchema,
  confirmPassword: z.string({ required_error: m.PASSWORD_CONFIRM_REQUIRED }),
};

const passwordsMatch = [
  (data) => data.password === data.confirmPassword,
  { path: ['confirmPassword'], message: m.PASSWORDS_DO_NOT_MATCH },
];

/** The ResetPassword form; the token comes from the link, not the form. */
export const newPasswordSchema = z.object(newPasswordFields).refine(...passwordsMatch);

export const resetPasswordSchema = z
  .object({ token: tokenSchema, ...newPasswordFields })
  .refine(...passwordsMatch);

/** The browser's handle on a Telegram sign-in request. */
export const telegramRequestIdSchema = z
  .string({ required_error: m.REQUEST_REQUIRED })
  .trim()
  .min(1, m.REQUEST_REQUIRED)
  .max(100, m.REQUEST_INVALID);

export const telegramStatusQuerySchema = z.object({ requestId: telegramRequestIdSchema });

/** Continue with Telegram; after a wrong code, the request the new one replaces. */
export const telegramStartSchema = z.object({
  previousRequestId: telegramRequestIdSchema.optional(),
});

export const telegramVerifySchema = z.object({
  requestId: telegramRequestIdSchema,
  otp: z
    .string({ required_error: m.OTP_REQUIRED })
    .trim()
    .regex(/^\d{6}$/, m.OTP_INVALID_FORMAT),
});

export const telegramResendSchema = z.object({ requestId: telegramRequestIdSchema });

/** Complete profile (Telegram signups): the name to keep and the email to verify. */
export const completeProfileSchema = z.object({ name: nameSchema, email: emailSchema });

/** Confirm link: the token from the email and the existing account's password. */
export const accountLinkConfirmSchema = z.object({
  token: tokenSchema,
  password: z
    .string({ required_error: m.PASSWORD_REQUIRED })
    .min(1, m.PASSWORD_REQUIRED)
    .max(128, m.PASSWORD_TOO_LONG),
});

/** Profile page: the fields a user edits themselves. At least one is required. */
export const updateProfileSchema = z
  .object({ name: nameSchema.optional(), language: languageSchema.optional() })
  .refine((data) => data.name !== undefined || data.language !== undefined, {
    message: m.NAME_REQUIRED,
    path: ['name'],
  });
