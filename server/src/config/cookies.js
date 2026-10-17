export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const REFRESH_PATH = '/api/auth';

function baseOptions(config) {
  return { httpOnly: true, sameSite: 'strict', secure: config.cookieSecure };
}

export function setSessionCookies(res, config, { accessToken, refreshToken }) {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...baseOptions(config),
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_MS,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseOptions(config),
    path: REFRESH_PATH,
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

export function clearSessionCookies(res, config) {
  res.clearCookie(ACCESS_COOKIE, { ...baseOptions(config), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...baseOptions(config), path: REFRESH_PATH });
}
