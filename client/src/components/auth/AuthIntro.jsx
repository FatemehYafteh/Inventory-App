import { Brand } from '@/components/Brand';
import { History, Languages, PackageCheck, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const FEATURES = [
  { key: 'stock', Icon: PackageCheck },
  { key: 'telegram', Icon: Send },
  { key: 'languages', Icon: Languages },
  { key: 'history', Icon: History },
];

/**
 * The product introduction beside the Login and Register forms: the name and a sentence on every
 * screen size, plus the key features from the `lg` breakpoint up.
 */
export function AuthIntro() {
  const { t } = useTranslation();
  return (
    <aside className="flex flex-col justify-center gap-6 bg-sidebar px-6 py-6 text-sidebar-foreground lg:sticky lg:top-0 lg:h-svh lg:px-8 lg:py-12">
      <div className="flex flex-col gap-2">
        <Brand className="gap-3" nameClassName="text-2xl lg:text-3xl" />
        <p className="text-sm text-sidebar-muted lg:text-lg">{t('auth.intro.tagline')}</p>
      </div>
      <ul className="hidden flex-col gap-5 lg:flex">
        {FEATURES.map(({ key, Icon }) => (
          <li key={key} className="flex items-start gap-3">
            <span className="mt-0.5 rounded-md bg-sidebar-accent p-2 text-sidebar-accent-foreground">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-medium">{t(`auth.intro.features.${key}.title`)}</p>
              <p className="text-sm text-sidebar-muted">{t(`auth.intro.features.${key}.body`)}</p>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
