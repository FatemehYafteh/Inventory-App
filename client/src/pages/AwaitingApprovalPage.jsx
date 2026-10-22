import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ME_QUERY_KEY, useLogout, useMe } from '@/lib/auth';

// The app opens by itself once an admin approves the account.
const APPROVAL_POLL_MS = 10_000;

export function AwaitingApprovalPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: user, isFetching } = useMe({
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? APPROVAL_POLL_MS : false),
  });
  const logout = useLogout();

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('auth.awaiting.title')}</CardTitle>
          <CardDescription>
            {t('auth.awaiting.description', { name: user?.name ?? '' })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="link" className="w-full justify-start px-0">
            <Link to="/profile">{t('auth.awaiting.editProfile')}</Link>
          </Button>
          <Button
            variant="outline"
            disabled={isFetching}
            onClick={() => queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY })}
          >
            {isFetching ? t('auth.awaiting.checking') : t('auth.awaiting.refresh')}
          </Button>
          <Button variant="ghost" onClick={() => logout.mutate()} disabled={logout.isPending}>
            {t('auth.common.logOut')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
