import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useTheme } from '@/theme/useTheme';

const OPTIONS = [
  { value: 'light', icon: SunIcon },
  { value: 'dark', icon: MoonIcon },
  { value: 'system', icon: MonitorIcon },
];

const BASE =
  'flex h-8 w-9 cursor-pointer items-center justify-center rounded-md border text-sm transition-colors peer-focus-visible:ring-[3px]';

// On the navy surface (sidebar, minimal bar) the buttons use the sidebar tokens.
const TONES = {
  page: {
    active: 'border-primary bg-primary text-primary-foreground peer-focus-visible:ring-ring',
    idle: 'bg-background shadow-xs hover:bg-accent hover:text-accent-foreground peer-focus-visible:ring-ring',
  },
  sidebar: {
    active:
      'border-sidebar-ring bg-sidebar-accent text-sidebar-accent-foreground peer-focus-visible:ring-sidebar-ring',
    idle: 'border-sidebar-accent bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground peer-focus-visible:ring-sidebar-ring',
  },
};

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
    <div role="radiogroup" aria-label={t('theme.label')} className="flex gap-1">
      {OPTIONS.map(({ value, icon: Icon }) => {
        const active = theme === value;
        return (
          <label key={value} title={t(`theme.${value}`)} className="relative">
            <input
              type="radio"
              name={name}
              value={value}
              checked={active}
              onChange={() => setTheme(value)}
              className="peer sr-only"
            />
            <span className={cn(BASE, active ? TONES[tone].active : TONES[tone].idle)}>
              <Icon className="size-4" aria-hidden="true" />
              <span className="sr-only">{t(`theme.${value}`)}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
