import axios from 'axios';

// Auth calls whose 401 means "bad credentials" or "no session", not "access token expired".
const NO_REFRESH_PATHS = new Set([
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  // Public: a wrong password answers 401 but says nothing about the session.
  '/auth/link-telegram/confirm',
]);
const NETWORK_ERROR = 'Could not reach the server. Check your connection and try again.';

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || 'Request failed');
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.code;
    this.errors = body?.errors;
  }
}

let onSessionExpired = () => {};

/** Called when a request fails with 401 and the refresh attempt fails too. */
export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler;
}

// Cookies carry the session (httpOnly); X-Requested-With is part of the CSRF defence.
const http = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
});

// One refresh at a time: parallel 401s share it, so a rotated token is never presented twice.
let refreshInFlight = null;

function refreshSession() {
  refreshInFlight ??= http
    .post('/auth/refresh')
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

// On a 401, refresh the session once and retry the request; every failure becomes an ApiError
// carrying the server's { message, code, errors }.
http.interceptors.response.use(undefined, async (error) => {
  const { config, response } = error;
  if (!response) throw new ApiError(0, { message: NETWORK_ERROR });

  const canRefresh = response.status === 401 && !NO_REFRESH_PATHS.has(config.url);
  if (canRefresh && !config.retriedAfterRefresh) {
    if (await refreshSession()) return http({ ...config, retriedAfterRefresh: true });
  }
  if (canRefresh) onSessionExpired();

  throw new ApiError(response.status, response.data);
});

/**
 * Calls the API and returns the parsed JSON body (null when empty). Throws ApiError on failure.
 * Pages use it through TanStack Query hooks, never directly in components.
 */
export async function api(path, { method = 'GET', body } = {}) {
  const { data } = await http.request({ url: path, method, data: body });
  return data && typeof data === 'object' ? data : null;
}
