import { useTranslation } from 'react-i18next';
import { segmentClass, segmentedGroupClass } from '@/components/segmented';
import { useLanguage } from '@/i18n/useLanguage';
import { cn } from '@/lib/utils';

// Each language is named in its own script, so it can be found whatever the current language is.
// The segment shows the short label; the full name is the accessible name and the tooltip.
const OPTIONS = [
  { value: 'en', short: 'EN', label: 'English', lang: 'en' },
  { value: 'fa', short: 'فا', label: 'فارسی', lang: 'fa' },
];

/** Two-way language switch. `tone="sidebar"` is for the navy surfaces. */
export function LanguageSwitcher({ tone = 'page' }) {
  const { t } = useTranslation();
  const { language, setLanguage, saveFailed } = useLanguage();

  return (
    <div className="flex flex-col gap-1.5">
      <div role="group" aria-label={t('language.label')} className={segmentedGroupClass(tone)}>
        {OPTIONS.map((option) => {
          const active = language === option.value;
          return (
            <button
              key={option.value}
              type="button"
              lang={option.lang}
              aria-pressed={active}
              aria-label={option.label}
              title={option.label}
              className={segmentClass(tone, active)}
              onClick={() => setLanguage(option.value)}
            >
              {option.short}
            </button>
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
