import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center">
      <PageHeader title={t('layout.notFound.title')} centered />
      <Button asChild variant="outline">
        <Link to="/">{t('layout.notFound.goHome')}</Link>
      </Button>
    </div>
  );
}
