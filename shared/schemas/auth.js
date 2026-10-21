import { z } from 'zod';
import { COMMON_PASSWORDS } from './common-passwords.js';

export const emailSchema = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .min(1, 'Email is required')
  .max(254, 'Email is too long')
  .email('Enter a valid email address');

// Rules for setting a password (register, reset). Login only checks presence.
export const passwordSchema = z
  .string({ required_error: 'Password is required' })
  .min(10, 'Password must be at least 10 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine((value) => !COMMON_PASSWORDS.has(value.toLowerCase()), {
    message: 'This password is too common. Choose another one.',
  });

/** The languages the app supports. */
export const LANGUAGES = ['en', 'fa'];

export const languageSchema = z.enum(LANGUAGES, { message: 'Choose a supported language' });

export const nameSchema = z
  .string({ required_error: 'Name is required' })
  .trim()
  .min(1, 'Name is required')
  .max(100, 'Name must be at most 100 characters');

/** One-time tokens from email links. */
export const tokenSchema = z
  .string({ required_error: 'Token is required' })
  .trim()
  .min(1, 'Token is required')
  .max(200, 'Token is invalid');

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required')
    .max(128, 'Password must be at most 128 characters'),
});

export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string({ required_error: 'Confirm your password' }),
    // The language the visitor chose before signing up; the verification email uses it.
    language: languageSchema.optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const verifyEmailSchema = z.object({ token: tokenSchema });

export const resendVerificationSchema = z.object({ email: emailSchema });

export const forgotPasswordSchema = z.object({ email: emailSchema });

const newPasswordFields = {
  password: passwordSchema,
  confirmPassword: z.string({ required_error: 'Confirm your password' }),
};

const passwordsMatch = [
  (data) => data.password === data.confirmPassword,
  { path: ['confirmPassword'], message: 'Passwords do not match' },
];

/** The ResetPassword form; the token comes from the link, not the form. */
export const newPasswordSchema = z.object(newPasswordFields).refine(...passwordsMatch);

export const resetPasswordSchema = z
  .object({ token: tokenSchema, ...newPasswordFields })
  .refine(...passwordsMatch);

/** The browser's handle on a Telegram sign-in request. */
export const telegramRequestIdSchema = z
  .string({ required_error: 'Request is required' })
  .trim()
  .min(1, 'Request is required')
  .max(100, 'Request is invalid');

export const telegramStatusQuerySchema = z.object({ requestId: telegramRequestIdSchema });

/** Continue with Telegram; after a wrong code, the request the new one replaces. */
export const telegramStartSchema = z.object({
  previousRequestId: telegramRequestIdSchema.optional(),
});

export const telegramVerifySchema = z.object({
  requestId: telegramRequestIdSchema,
  otp: z
    .string({ required_error: 'Enter the code' })
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export const telegramResendSchema = z.object({ requestId: telegramRequestIdSchema });

/** Complete profile (Telegram signups): the name to keep and the email to verify. */
export const completeProfileSchema = z.object({ name: nameSchema, email: emailSchema });

/** Confirm link: the token from the email and the existing account's password. */
export const accountLinkConfirmSchema = z.object({
  token: tokenSchema,
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required')
    .max(128, 'Password must be at most 128 characters'),
});

/** Profile page: the fields a user edits themselves. At least one is required. */
export const updateProfileSchema = z
  .object({ name: nameSchema.optional(), language: languageSchema.optional() })
  .refine((data) => data.name !== undefined || data.language !== undefined, {
    message: 'Name is required',
    path: ['name'],
  });
