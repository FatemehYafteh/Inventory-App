import { REFRESH_COOKIE, clearSessionCookies, setSessionCookies } from '../config/cookies.js';
import { telegramStatusQuerySchema } from '@inventory/shared/schemas';
import * as authService from '../services/auth.service.js';
import * as profileService from '../services/profile.service.js';
import * as telegramAuth from '../services/telegramAuth.service.js';
import { AppError } from '../utils/AppError.js';
import { toPublicUser } from '../utils/publicUser.js';

function requestMeta(req) {
  return { ip: req.ip, userAgent: req.get('user-agent')?.slice(0, 256) };
}

export async function login(req, res) {
  const { config } = req.app.locals;
  const { user, tokens } = await authService.loginWithPassword(req.body, requestMeta(req), config);
  setSessionCookies(res, config, tokens);
  res.json({ user: toPublicUser(user) });
}

export async function refresh(req, res) {
  const { config } = req.app.locals;
  try {
    const tokens = await authService.refreshSession(
      req.cookies?.[REFRESH_COOKIE],
      requestMeta(req),
      config,
    );
    setSessionCookies(res, config, tokens);
    res.status(204).end();
  } catch (err) {
    clearSessionCookies(res, config);
    throw err;
  }
}

export async function logout(req, res) {
  const { config } = req.app.locals;
  await authService.logout(req.cookies?.[REFRESH_COOKIE], config);
  clearSessionCookies(res, config);
  res.status(204).end();
}

// Same body for every outcome, so the response never reveals whether an account exists.
const CHECK_EMAIL_MESSAGE =
  'If this email can be used, we have sent a verification link. Check your inbox.';

export async function register(req, res) {
  const { config, mailer } = req.app.locals;
  await authService.register(req.body, { config, mailer });
  res.status(202).json({ message: CHECK_EMAIL_MESSAGE });
}

export async function resendVerification(req, res) {
  const { config, mailer } = req.app.locals;
  await authService.resendVerification(req.body, { config, mailer });
  res.status(202).json({ message: CHECK_EMAIL_MESSAGE });
}

export async function verifyEmail(req, res) {
  const { completedProfile } = await authService.verifyEmail(req.body, req.app.locals.config);
  res.json({
    message: completedProfile
      ? 'Email verified. Return to the app or log in.'
      : 'Your email is verified. You can now log in.',
  });
}

export async function completeProfile(req, res) {
  const { config, mailer } = req.app.locals;
  await profileService.completeProfile(req.user, req.body, { config, mailer });
  res.status(202).json({ message: CHECK_EMAIL_MESSAGE });
}

export async function resendProfileVerification(req, res) {
  const { config, mailer } = req.app.locals;
  await profileService.resendProfileEmail(req.user, { config, mailer });
  res.status(202).json({ message: CHECK_EMAIL_MESSAGE });
}

export function me(req, res) {
  res.json({ user: toPublicUser(req.user) });
}

const RESET_SENT_MESSAGE =
  'If an account can reset its password with this email, we have sent a link. Check your inbox.';

export async function forgotPassword(req, res) {
  const { config, mailer } = req.app.locals;
  await authService.forgotPassword(req.body, { config, mailer });
  res.status(202).json({ message: RESET_SENT_MESSAGE });
}

export async function resetPassword(req, res) {
  const { config, mailer } = req.app.locals;
  await authService.resetPassword(req.body, { config, mailer });
  res.json({ message: 'Your password has been changed. Log in with your new password.' });
}

export async function telegramStart(req, res) {
  const result = await telegramAuth.startLogin(requestMeta(req), req.app.locals.config);
  res.status(201).json(result);
}

export async function telegramStatus(req, res) {
  const parsed = telegramStatusQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed');
  res.json(await telegramAuth.getStatus(parsed.data.requestId));
}

export async function telegramResend(req, res) {
  const { config, telegram } = req.app.locals;
  res.json(await telegramAuth.resendCode(req.body, config, { messenger: telegram }));
}

export async function telegramVerify(req, res) {
  const { config } = req.app.locals;
  const { user, tokens } = await telegramAuth.verifyLogin(req.body, requestMeta(req), config);
  setSessionCookies(res, config, tokens);
  res.json({ user: toPublicUser(user) });
}
