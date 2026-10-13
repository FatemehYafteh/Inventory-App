const BASE_URL = '/api';

// Auth calls whose 401 means "bad credentials" or "no session", not "access token expired".
const NO_REFRESH_PATHS = new Set(['/auth/login', '/auth/refresh', '/auth/logout']);

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

function send(path, { method = 'GET', body } = {}) {
  return fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// One refresh at a time: parallel 401s share it, so a rotated token is never presented twice.
let refreshInFlight = null;

function refreshSession() {
  refreshInFlight ??= send('/auth/refresh', { method: 'POST' })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

async function parse(res) {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * fetch wrapper for the API: sends cookies and the CSRF header, retries once after a 401
 * by refreshing the session, and throws ApiError with the server's { message, code, errors }.
 */
export async function api(path, options = {}) {
  let res = await send(path, options);

  if (res.status === 401 && !NO_REFRESH_PATHS.has(path)) {
    if (await refreshSession()) {
      res = await send(path, options);
    }
    if (res.status === 401) onSessionExpired();
  }

  const body = await parse(res);
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}
