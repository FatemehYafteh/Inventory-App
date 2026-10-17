import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Rejecting asks for an optional reason, which the user gets in the rejection email. */
export function RejectUserDialog({ user, busy, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');
  if (!user) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onConfirm(user, reason.trim());
          }}
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
            <Label htmlFor="reject-reason">Reason (optional)</Label>
            <Input
              id="reject-reason"
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
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
