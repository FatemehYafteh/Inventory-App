import { useTranslation } from 'react-i18next';
import { TBdi } from '@/components/BidiText';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function ArchiveProductDialog({ product, onConfirm, onCancel, onCloseAutoFocus }) {
  const { t } = useTranslation();
  if (!product) return null;

  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle className="[overflow-wrap:anywhere]">
            <TBdi i18nKey="products.archive.title" values={{ title: product.title }} />
          </AlertDialogTitle>
          <AlertDialogDescription>{t('products.archive.description')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('products.archive.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(product)}>
            {t('products.archive.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
