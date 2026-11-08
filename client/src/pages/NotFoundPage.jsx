import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Brand } from '@/components/Brand';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center">
      <Brand />
      <PageHeader
        title={t('layout.notFound.title')}
        description={t('layout.notFound.description')}
        centered
      />
      <Button asChild variant="outline">
        <Link to="/">{t('layout.notFound.goHome')}</Link>
      </Button>
    </div>
  );
}
