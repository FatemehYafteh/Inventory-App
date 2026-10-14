import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ME_QUERY_KEY, useLogout, useMe } from '@/lib/auth';

export function AwaitingApprovalPage() {
  const queryClient = useQueryClient();
  const { data: user, isFetching } = useMe();
  const logout = useLogout();

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Awaiting approval</CardTitle>
          <CardDescription>
            Thanks, {user?.name}. An admin needs to approve your account before you can use the app.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="link" className="w-full justify-start px-0">
            <Link to="/profile">Edit profile / connect Telegram</Link>
          </Button>
          <Button
            variant="outline"
            disabled={isFetching}
            onClick={() => queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY })}
          >
            {isFetching ? 'Checking…' : 'Refresh'}
          </Button>
          <Button variant="ghost" onClick={() => logout.mutate()} disabled={logout.isPending}>
            Log out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
