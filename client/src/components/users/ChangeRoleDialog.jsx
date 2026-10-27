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

/** Confirms a promotion or demotion; the change takes effect on the user's next request. */
export function ChangeRoleDialog({ user, onConfirm, onCancel }) {
  const { t } = useTranslation();
  if (!user) return null;
  const role = user.role === 'admin' ? 'staff' : 'admin';
  const name = user.name ?? t('users.changeRole.thisUser');

  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t(role === 'admin' ? 'users.changeRole.titleAdmin' : 'users.changeRole.titleStaff', {
              name,
            })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              role === 'admin'
                ? 'users.changeRole.descriptionAdmin'
                : 'users.changeRole.descriptionStaff',
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('users.changeRole.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(user, role)}>
            {role === 'admin'
              ? t('users.changeRole.confirmAdmin')
              : t('users.changeRole.confirmStaff')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
