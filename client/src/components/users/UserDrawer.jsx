import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
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
  const { t } = useTranslation();
  if (!history.length) {
    return <p className="text-sm text-muted-foreground">{t('users.drawer.historyEmpty')}</p>;
  }
  // The server sends the newest change first.
  return (
    <ol aria-label={t('users.drawer.historyTitle')} className="flex flex-col gap-3">
      {history.map((change) => (
        <li key={change.id} className="rounded-md border p-3 text-sm">
          <p className="font-medium">
            {t('users.drawer.historyChange', {
              from: t(`users.statusTitle.${change.from}`),
              to: t(`users.statusTitle.${change.to}`),
            })}
          </p>
          <p className="text-muted-foreground">
            {t('users.drawer.historyBy', {
              name: change.changedByName,
              date: formatDateTime(change.at),
            })}
          </p>
          {change.reason && <p className="mt-1">{change.reason}</p>}
        </li>
      ))}
    </ol>
  );
}

function Details({ user, history }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6 px-4 pb-4">
      <dl className="grid grid-cols-2 gap-4">
        <Field label={t('users.drawer.email')}>
          <EmailCell user={user} />
        </Field>
        <Field label={t('users.drawer.telegram')}>
          {user.telegramUsername ? `@${user.telegramUsername}` : '—'}
        </Field>
        <Field label={t('users.drawer.methods')}>
          <SignInMethods user={user} />
        </Field>
        <Field label={t('users.drawer.role')}>
          <Badge variant="secondary">{t(`users.role.${user.role}`)}</Badge>
        </Field>
        <Field label={t('users.drawer.status')}>
          <StatusBadge status={user.status} label={t(`users.status.${user.status}`)} />
        </Field>
        {user.statusReason && <Field label={t('users.drawer.reason')}>{user.statusReason}</Field>}
        <Field label={t('users.drawer.createdAt')}>{formatDate(user.createdAt)}</Field>
        <Field label={t('users.drawer.lastLoginAt')}>
          {user.lastLoginAt ? formatDate(user.lastLoginAt) : t('users.drawer.never')}
        </Field>
      </dl>

      <section className="flex flex-col gap-2">
        <h3 className="font-medium">{t('users.drawer.historyTitle')}</h3>
        <StatusHistory history={history} />
      </section>

      <section className="flex flex-col gap-2">
        <Button asChild variant="outline" className="w-fit">
          <Link to={`/movements?user=${encodeURIComponent(user.id)}`}>
            {t('users.drawer.viewMovements')}
          </Link>
        </Button>
      </section>
    </div>
  );
}

/** Side panel with one user's profile and status history. Open while `userId` is set. */
export function UserDrawer({ userId, onClose }) {
  const { t } = useTranslation();
  const detail = useUser(userId);

  return (
    <Sheet open={Boolean(userId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{detail.data?.user.name ?? t('users.drawer.defaultTitle')}</SheetTitle>
          <SheetDescription>{t('users.drawer.description')}</SheetDescription>
        </SheetHeader>
        {detail.isPending && !detail.error && (
          <p role="status" className="px-4 text-sm text-muted-foreground">
            {t('users.drawer.loading')}
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
