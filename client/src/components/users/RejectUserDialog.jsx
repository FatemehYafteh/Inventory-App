import { changeStatusSchema } from '@inventory/shared/schemas';
import { useTranslation } from 'react-i18next';
import { TextField } from '@/components/form/TextField';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useZodForm } from '@/hooks/useZodForm';

// The reason is the only field of the status change that the admin types.
const rejectSchema = changeStatusSchema.pick({ reason: true });

/** Rejecting asks for an optional reason, which the user gets in the rejection email. */
export function RejectUserDialog({ user, busy, onConfirm, onCancel }) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useZodForm(rejectSchema, { defaultValues: { reason: '' } });
  if (!user) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <form
          noValidate
          onSubmit={handleSubmit(({ reason }) => onConfirm(user, reason))}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>
              {t('users.reject.title', { name: user.name ?? t('users.reject.thisUser') })}
            </DialogTitle>
            <DialogDescription>{t('users.reject.description')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <TextField
              id="reject-reason"
              label={t('users.reject.reasonLabel')}
              error={errors.reason}
              {...register('reason')}
            />
            <p className="text-xs text-muted-foreground">{t('users.reject.reasonHelp')}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              {t('users.reject.cancel')}
            </Button>
            <Button type="submit" disabled={busy}>
              {t('users.reject.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
