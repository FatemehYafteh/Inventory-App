// Keeps work that runs after the HTTP response (background emails, Telegram messages) alive on
// Vercel. A Vercel Function can be frozen as soon as the response is sent, which would drop an
// unfinished send and its retries. Vercel exposes the current request's `waitUntil` under this
// global symbol; it is what `waitUntil` from `@vercel/functions` calls. Elsewhere (local server,
// tests) there is no such context and the promise simply runs on, as before.

const REQUEST_CONTEXT = Symbol.for('@vercel/request-context');

/** Asks the platform to keep the function alive until `promise` settles. Returns `promise`. */
export function waitUntil(promise) {
  try {
    const context = globalThis[REQUEST_CONTEXT]?.get?.();
    context?.waitUntil?.(promise);
  } catch {
    // Never let the platform hook break the request; the work still runs.
  }
  return promise;
}
