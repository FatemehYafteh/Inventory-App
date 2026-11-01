import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useDelayedFlag } from '@/hooks/useDelayedFlag';

// A bar only for requests that take longer than this; faster ones would just flicker.
export const BAR_DELAY_MS = 300;
// After this long with a request still open, say the server may be starting (a cold start).
export const SLOW_DELAY_MS = 4000;

// Background polling (Telegram status, pending count) is not something the person waits for.
const isUserWaiting = (query) => !query.options.refetchInterval;

/**
 * A thin bar at the top of the page while a request has been open for over 300 ms, and a short
 * message if it is still open after 4 s. Counts every TanStack Query fetch and mutation except
 * polling queries. Mounted once, outside the routes, so it also shows on the signed-out pages.
 */
export function GlobalLoading() {
  const { t } = useTranslation();
  const fetching = useIsFetching({ predicate: isUserWaiting });
  const mutating = useIsMutating();
  const busy = fetching + mutating > 0;
  const showBar = useDelayedFlag(busy, BAR_DELAY_MS);
  const showSlow = useDelayedFlag(busy, SLOW_DELAY_MS);

  return (
    <>
      {showBar && (
        <div
          role="progressbar"
          aria-label={t('common.loading')}
          className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-1 overflow-hidden bg-primary/20"
        >
          <div className="loading-bar-fill h-full w-1/3 bg-primary" />
        </div>
      )}
      {/* The live region stays mounted so screen readers announce the text when it appears. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-4"
      >
        {showSlow && (
          <p className="rounded-md border bg-card px-3 py-2 text-sm text-card-foreground shadow-md">
            {t('common.serverStarting')}
          </p>
        )}
      </div>
    </>
  );
}
