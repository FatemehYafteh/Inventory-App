import { useTranslation } from 'react-i18next';
import { productCountLabel } from '@/components/categories/CategoryCard';
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

function ConfirmDialog({
  supplier,
  title,
  description,
  action,
  onConfirm,
  onCancel,
  onCloseAutoFocus,
}) {
  const { t } = useTranslation();
  if (!supplier) return null;

  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('suppliers.dialogs.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(supplier)}>{action}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DeleteSupplierDialog({ supplier, ...props }) {
  const { t } = useTranslation();
  return (
    <ConfirmDialog
      supplier={supplier}
      title={t('suppliers.dialogs.deleteTitle', { name: supplier?.name })}
      description={t('suppliers.dialogs.deleteDescription')}
      action={t('suppliers.dialogs.delete')}
      {...props}
    />
  );
}

export function DeactivateSupplierDialog({ supplier, ...props }) {
  const { t } = useTranslation();
  return (
    <ConfirmDialog
      supplier={supplier}
      title={t('suppliers.dialogs.deactivateTitle', { name: supplier?.name })}
      description={t('suppliers.dialogs.deactivateDescription', {
        products: supplier ? productCountLabel(supplier.productCount) : '',
      })}
      action={t('suppliers.dialogs.deactivate')}
      {...props}
    />
  );
}
