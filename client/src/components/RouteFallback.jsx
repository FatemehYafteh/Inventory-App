import { useTranslation } from 'react-i18next';
import { useDelayedFlag } from '@/hooks/useDelayedFlag';
import { cn } from '@/lib/utils';

/**
 * Shown while a page's code downloads (pages load on demand). The text appears only after
 * 300 ms, so a fast load shows nothing and a slow one says it is loading. `inline` is for the
 * page area inside the app shell; otherwise it fills the screen.
 */
export function RouteFallback({ inline = false }) {
  const { t } = useTranslation();
  const slow = useDelayedFlag(true, 300);
  return (
    <div
      role="status"
      className={cn(
        'grid place-items-center p-4 text-sm text-muted-foreground',
        inline ? 'min-h-40' : 'min-h-svh',
      )}
    >
      {slow ? t('common.loading') : null}
    </div>
  );
}
