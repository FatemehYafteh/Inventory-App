import { FormAlert } from '@/components/form/FormAlert';
import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  EmailCell,
  SignInMethods,
  capitalize,
  formatDate,
  formatDateTime,
} from '@/components/users/userDisplay';
import { errorMessage } from '@/lib/errors';
import { useUser } from '@/lib/users';

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function StatusHistory({ history }) {
  if (!history.length) {
    return <p className="text-sm text-muted-foreground">No status changes yet.</p>;
  }
  // The server sends the newest change first.
  return (
    <ol aria-label="Status history" className="flex flex-col gap-3">
      {history.map((change) => (
        <li key={change.id} className="rounded-md border p-3 text-sm">
          <p className="font-medium">
            {capitalize(change.from)} to {capitalize(change.to)}
          </p>
          <p className="text-muted-foreground">
            by {change.changedByName} on {formatDateTime(change.at)}
          </p>
          {change.reason && <p className="mt-1">{change.reason}</p>}
        </li>
      ))}
    </ol>
  );
}

function Details({ user, history }) {
  return (
    <div className="flex flex-col gap-6 px-4 pb-4">
      <dl className="grid grid-cols-2 gap-4">
        <Field label="Email">
          <EmailCell user={user} />
        </Field>
        <Field label="Telegram">{user.telegramUsername ? `@${user.telegramUsername}` : '—'}</Field>
        <Field label="Sign-in methods">
          <SignInMethods user={user} />
        </Field>
        <Field label="Role">
          <Badge variant="secondary">{user.role}</Badge>
        </Field>
        <Field label="Status">
          <StatusBadge status={user.status} label={user.status} />
        </Field>
        {user.statusReason && <Field label="Reason">{user.statusReason}</Field>}
        <Field label="Signed up">{formatDate(user.createdAt)}</Field>
        <Field label="Last login">
          {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
        </Field>
      </dl>

      <section className="flex flex-col gap-2">
        <h3 className="font-medium">Status history</h3>
        <StatusHistory history={history} />
      </section>

      <section className="flex flex-col gap-2">
        {/* The Movements page arrives in a later milestone, which enables this link. */}
        <Button
          variant="outline"
          disabled
          className="w-fit"
          title="Available once Movements ships."
        >
          View movements
        </Button>
        <p className="text-xs text-muted-foreground">Available once Movements ships.</p>
      </section>
    </div>
  );
}

/** Side panel with one user's profile and status history. Open while `userId` is set. */
export function UserDrawer({ userId, onClose }) {
  const detail = useUser(userId);

  return (
    <Sheet open={Boolean(userId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{detail.data?.user.name ?? 'User details'}</SheetTitle>
          <SheetDescription>Profile and status history</SheetDescription>
        </SheetHeader>
        {detail.isPending && !detail.error && (
          <p role="status" className="px-4 text-sm text-muted-foreground">
            Loading…
          </p>
        )}
        {detail.error && (
          <div className="px-4">
            <FormAlert>{errorMessage(detail.error)}</FormAlert>
          </div>
        )}
        {detail.data && <Details user={detail.data.user} history={detail.data.history} />}
      </SheetContent>
    </Sheet>
  );
}
