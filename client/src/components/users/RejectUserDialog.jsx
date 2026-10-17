import { changeStatusSchema } from '@inventory/shared/schemas';
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
            <DialogTitle>Reject {user.name ?? 'this user'}?</DialogTitle>
            <DialogDescription>
              They are signed out at once and cannot log in. They get an email, and a Telegram
              message if they use the bot.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <TextField
              id="reject-reason"
              label="Reason (optional)"
              error={errors.reason}
              {...register('reason')}
            />
            <p className="text-xs text-muted-foreground">
              The reason is included in the email, not in the Telegram message.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Reject user
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
