import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import i18n from '@/i18n';

export { formatDate, formatDateTime } from '@/lib/format';

const USER_STATUSES = ['active', 'pending', 'rejected', 'inactive'];
const ROLES = ['admin', 'staff'];

/**
 * "rejected" becomes "Rejected" (statuses are stored in lower case). Known user statuses and
 * roles use the translated label; anything else is just capitalised.
 */
export function capitalize(value) {
  if (USER_STATUSES.includes(value)) return i18n.t(`common.status.${value}`);
  if (ROLES.includes(value)) return i18n.t(`common.role.${value}`);
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** The email with its verified state, or "No email" for a Telegram signup that has none. */
export function EmailCell({ user }) {
  const { t } = useTranslation();
  if (!user.email) return <span className="text-muted-foreground">{t('common.user.noEmail')}</span>;
  return (
    <div className="flex flex-col gap-0.5">
      <span>{user.email}</span>
      <span className="text-xs text-muted-foreground">
        {user.emailVerified ? t('common.user.verified') : t('common.user.notVerified')}
      </span>
    </div>
  );
}

/** Email + password and Telegram, as the ways this user can sign in. */
export function SignInMethods({ user }) {
  const { t } = useTranslation();
  const methods = [
    user.email && user.hasPassword && t('common.user.email'),
    user.hasTelegram && t('common.user.telegram'),
  ].filter(Boolean);
  if (!methods.length)
    return <span className="text-muted-foreground">{t('common.user.noneYet')}</span>;
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
