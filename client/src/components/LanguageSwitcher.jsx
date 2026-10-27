import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/useLanguage';
import { cn } from '@/lib/utils';

// Each language is named in its own script, so it can be found whatever the current language is.
const OPTIONS = [
  { value: 'en', label: 'English', lang: 'en' },
  { value: 'fa', label: 'فارسی', lang: 'fa' },
];

// On the navy surface (sidebar, minimal bar) the buttons use the sidebar tokens.
const SIDEBAR_ACTIVE =
  'border-sidebar-ring bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent';
const SIDEBAR_IDLE =
  'border-sidebar-accent bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground';

/** Two-way language switch. `tone="sidebar"` is for the navy surfaces. */
export function LanguageSwitcher({ tone = 'page' }) {
  const { t } = useTranslation();
  const { language, setLanguage, saveFailed } = useLanguage();

  return (
    <div className="flex flex-col gap-1.5">
      <div role="group" aria-label={t('language.label')} className="flex gap-1">
        {OPTIONS.map((option) => {
          const active = language === option.value;
          return (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={active ? 'default' : 'outline'}
              lang={option.lang}
              aria-pressed={active}
              className={cn(
                active && 'font-semibold',
                tone === 'sidebar' && (active ? SIDEBAR_ACTIVE : SIDEBAR_IDLE),
              )}
              onClick={() => setLanguage(option.value)}
            >
              {option.label}
            </Button>
          );
        })}
      </div>
      {saveFailed && (
        <p
          role="alert"
          className={cn('text-xs', tone === 'sidebar' ? 'text-sidebar-muted' : 'text-danger')}
        >
          {t('language.saveFailed')}
        </p>
      )}
    </div>
  );
}
