const KEY = 'chunk-reload-at';
// A second failure within this time is not retried, so a chunk that is really missing cannot
// reload the page forever.
const LOOP_GUARD_MS = 10_000;

/**
 * After a new version is deployed, a tab that was already open asks for a page file that no longer
 * exists (the host answers with the app's HTML instead) and Vite fires `vite:preloadError`. One
 * reload fetches the new version. Returns the function that removes the listener.
 */
export function reloadOnStaleChunk({
  target = window,
  storage = window.sessionStorage,
  reload = () => window.location.reload(),
  now = () => Date.now(),
} = {}) {
  const onError = (event) => {
    let last = 0;
    try {
      last = Number(storage.getItem(KEY)) || 0;
    } catch {
      // Storage can be blocked; without it the guard below cannot remember, so do not reload.
      return;
    }
    if (now() - last < LOOP_GUARD_MS) return;
    try {
      storage.setItem(KEY, String(now()));
    } catch {
      return;
    }
    event.preventDefault();
    reload();
  };
  target.addEventListener('vite:preloadError', onError);
  return () => target.removeEventListener('vite:preloadError', onError);
}
