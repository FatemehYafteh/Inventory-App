import { Router } from 'express';
import {
  completeProfileSchema,
  forgotPasswordSchema,
  accountLinkConfirmSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  telegramResendSchema,
  telegramStartSchema,
  telegramVerifySchema,
  updateProfileSchema,
  verifyEmailSchema,
} from '@inventory/shared/schemas';
import * as auth from '../controllers/auth.controller.js';
import { authenticate, identify } from '../middleware/auth.js';
import { authLimits } from '../middleware/rateLimit.js';
import { requireIncompleteProfile, requireProfile } from '../middleware/requireProfile.js';
import { validate } from '../middleware/validate.js';

export function authRoutes(config) {
  const router = Router();

  const login = authLimits.login();
  router.post('/login', login.ip, validate(loginSchema), login.email, auth.login);

  const register = authLimits.register();
  router.post('/register', register.ip, validate(registerSchema), register.email, auth.register);

  router.post(
    '/verify-email',
    authLimits.verifyEmail(),
    validate(verifyEmailSchema),
    auth.verifyEmail,
  );

  const resend = authLimits.resendVerification();
  router.post(
    '/resend-verification',
    resend.ip,
    validate(resendVerificationSchema),
    resend.email,
    auth.resendVerification,
  );

  // Also serves as "resend": the service skips sending within the 60 s cooldown.
  const forgot = authLimits.forgotPassword();
  router.post(
    '/forgot-password',
    forgot.ip,
    validate(forgotPasswordSchema),
    forgot.email,
    auth.forgotPassword,
  );

  router.post(
    '/reset-password',
    authLimits.resetPassword(),
    validate(resetPasswordSchema),
    auth.resetPassword,
  );

  router.post(
    '/telegram/start',
    authLimits.telegramStart(),
    validate(telegramStartSchema),
    auth.telegramStart,
  );
  // Shared by sign-in and Connect Telegram; a connect request is visible only to its user.
  router.get(
    '/telegram/status',
    authLimits.telegramStatus(),
    identify(config),
    auth.telegramStatus,
  );
  router.post(
    '/telegram/verify',
    authLimits.telegramVerify(),
    validate(telegramVerifySchema),
    auth.telegramVerify,
  );
  router.post(
    '/telegram/resend',
    authLimits.telegramResend(),
    identify(config),
    validate(telegramResendSchema),
    auth.telegramResend,
  );

  // Connect Telegram (Profile page): the signed-in user adds a Telegram account.
  router.post(
    '/telegram/connect/start',
    authLimits.telegramConnectStart(),
    authenticate(config),
    requireProfile,
    auth.telegramConnectStart,
  );
  router.post(
    '/telegram/connect/verify',
    authLimits.telegramConnectVerify(),
    authenticate(config),
    requireProfile,
    validate(telegramVerifySchema),
    auth.telegramConnectVerify,
  );

  router.post('/refresh', authLimits.refresh(), auth.refresh);
  // Logout works with only the refresh cookie, so an expired access token never blocks it.
  router.post('/logout', auth.logout);
  router.get('/me', authenticate(config), auth.me);

  // Complete profile (Telegram signups): allowed while the profile is incomplete.
  const profileEmails = authLimits.completeProfile();
  router.post(
    '/profile/complete',
    profileEmails,
    authenticate(config),
    requireIncompleteProfile,
    validate(completeProfileSchema),
    auth.completeProfile,
  );
  router.post(
    '/profile/resend-verification',
    profileEmails,
    authenticate(config),
    requireIncompleteProfile,
    auth.resendProfileVerification,
  );

  // Profile page: pending and active users with a complete profile (rejected users are
  // refused by authenticate).
  router.patch(
    '/profile',
    authenticate(config),
    requireProfile,
    validate(updateProfileSchema),
    auth.updateProfile,
  );

  // Opened from the link-confirmation email; signs no one in.
  router.post(
    '/link-telegram/confirm',
    authLimits.accountLinkConfirm(),
    validate(accountLinkConfirmSchema),
    auth.confirmAccountLink,
  );

  return router;
}
