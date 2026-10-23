import { DownloadIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/errors';
import { useDownload } from '@/lib/download';

/**
 * Downloads the CSV at `path` (an API export path that already carries the current filters, so
 * the file holds exactly what the page shows). A failure appears next to the button.
 */
export function ExportCsvButton({ path, label }) {
  const { t } = useTranslation();
  const download = useDownload();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={download.isPending}
        onClick={() => download.mutate(path)}
      >
        <DownloadIcon className="size-4" aria-hidden="true" />
        {download.isPending ? t('common.export.exporting') : (label ?? t('common.export.csv'))}
      </Button>
      {download.error && (
        <p role="alert" className="text-sm text-danger">
          {errorMessage(download.error)}
        </p>
      )}
    </div>
  );
}
