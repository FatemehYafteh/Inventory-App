import { Badge } from '@/components/ui/badge';

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export const formatDate = (value) => dateFormat.format(new Date(value));
export const formatDateTime = (value) => dateTimeFormat.format(new Date(value));

/** "rejected" becomes "Rejected" (statuses are stored in lower case). */
export const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);

/** The email with its verified state, or "No email" for a Telegram signup that has none. */
export function EmailCell({ user }) {
  if (!user.email) return <span className="text-muted-foreground">No email</span>;
  return (
    <div className="flex flex-col gap-0.5">
      <span>{user.email}</span>
      <span className="text-xs text-muted-foreground">
        {user.emailVerified ? 'Verified' : 'Not verified'}
      </span>
    </div>
  );
}

/** Email + password and Telegram, as the ways this user can sign in. */
export function SignInMethods({ user }) {
  const methods = [
    user.email && user.hasPassword && 'Email',
    user.hasTelegram && 'Telegram',
  ].filter(Boolean);
  if (!methods.length) return <span className="text-muted-foreground">None yet</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {methods.map((method) => (
        <Badge key={method} variant="outline">
          {method}
        </Badge>
      ))}
    </div>
  );
}
