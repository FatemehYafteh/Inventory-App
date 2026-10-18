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
  if (!supplier) return null;

  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(supplier)}>{action}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DeleteSupplierDialog({ supplier, ...props }) {
  return (
    <ConfirmDialog
      supplier={supplier}
      title={`Delete ${supplier?.name}?`}
      description="This removes the supplier. It cannot be undone."
      action="Delete"
      {...props}
    />
  );
}

export function DeactivateSupplierDialog({ supplier, ...props }) {
  return (
    <ConfirmDialog
      supplier={supplier}
      title={`Deactivate ${supplier?.name}?`}
      description={`It still has ${supplier ? productCountLabel(supplier.productCount) : ''}. Reactivate it at any time.`}
      action="Deactivate"
      {...props}
    />
  );
}
