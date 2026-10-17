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
  if (!user) return null;
  const role = user.role === 'admin' ? 'staff' : 'admin';
  const name = user.name ?? 'this user';

  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Make {name} {role === 'admin' ? 'an admin' : 'staff'}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {role === 'admin'
              ? 'Admins manage users, categories and suppliers, and can archive products.'
              : 'Staff can work with products and stock, but cannot manage users.'}{' '}
            The change applies on their next request.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(user, role)}>
            {role === 'admin' ? 'Make admin' : 'Make staff'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
