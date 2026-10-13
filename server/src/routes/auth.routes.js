import { Router } from 'express';
import {
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  verifyEmailSchema,
} from '@inventory/shared/schemas';
import * as auth from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authLimits } from '../middleware/rateLimit.js';
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

  router.post('/refresh', authLimits.refresh(), auth.refresh);
  // Logout works with only the refresh cookie, so an expired access token never blocks it.
  router.post('/logout', auth.logout);
  router.get('/me', authenticate(config), auth.me);

  return router;
}
