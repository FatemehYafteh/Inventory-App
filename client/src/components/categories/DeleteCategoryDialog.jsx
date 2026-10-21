import { useTranslation } from 'react-i18next';
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

export function DeleteCategoryDialog({ category, onConfirm, onCancel, onCloseAutoFocus }) {
  const { t } = useTranslation();
  if (!category) return null;

  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('categories.delete.title', { title: category.title })}
          </AlertDialogTitle>
          <AlertDialogDescription>{t('categories.delete.description')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('categories.delete.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(category)}>
            {t('categories.delete.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
