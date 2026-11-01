import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

/** The logo mark: a box on a rounded tile. Keep in step with public/favicon.svg. */
export function BrandMark({ className }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('size-7 shrink-0', className)}>
      <rect width="32" height="32" rx="7" className="fill-sidebar-accent" />
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 5 26 10.5v11L16 27 6 21.5v-11z" />
        <path d="M6 10.5 16 16l10-5.5M16 16v11" />
      </g>
    </svg>
  );
}

/** Logo and product name, translated. Used on the dark sidebar and header bands. */
export function Brand({ className, nameClassName }) {
  const { t } = useTranslation();
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <BrandMark />
      <span className={cn('font-semibold', nameClassName)}>{t('brand.name')}</span>
    </span>
  );
}
