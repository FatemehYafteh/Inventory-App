import { REFRESH_COOKIE, clearSessionCookies, setSessionCookies } from '../config/cookies.js';
import * as authService from '../services/auth.service.js';
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
  await authService.verifyEmail(req.body, req.app.locals.config);
  res.json({ message: 'Your email is verified. You can now log in.' });
}

export function me(req, res) {
  res.json({ user: toPublicUser(req.user) });
}
