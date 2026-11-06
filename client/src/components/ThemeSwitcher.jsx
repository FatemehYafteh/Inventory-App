import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { segmentClass, segmentedGroupClass } from '@/components/segmented';
import { cn } from '@/lib/utils';
import { useTheme } from '@/theme/useTheme';

const OPTIONS = [
  { value: 'light', icon: SunIcon },
  { value: 'dark', icon: MoonIcon },
  { value: 'system', icon: MonitorIcon },
];

/**
 * Light / Dark / System choice, saved in this browser. Each option is a native radio, so the
 * arrow keys, the single tab stop and right-to-left behaviour come from the browser. The icon is
 * the visible part; the name is in the label for screen readers and the tooltip.
 * `tone="sidebar"` is for the navy surfaces.
 */
export function ThemeSwitcher({ tone = 'page' }) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  // The sidebar and the mobile menu can both be in the page, so each needs its own radio group.
  const name = useId();

  return (
    <div role="radiogroup" aria-label={t('theme.label')} className={segmentedGroupClass(tone)}>
      {OPTIONS.map(({ value, icon: Icon }) => {
        const active = theme === value;
        return (
          <label key={value} title={t(`theme.${value}`)} className="relative flex">
            <input
              type="radio"
              name={name}
              value={value}
              checked={active}
              onChange={() => setTheme(value)}
              className="peer sr-only"
            />
            <span className={cn(segmentClass(tone, active, { peer: true }), 'w-full')}>
              <Icon className="size-4" aria-hidden="true" />
              <span className="sr-only">{t(`theme.${value}`)}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
