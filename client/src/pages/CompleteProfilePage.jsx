import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLogout, useMe } from '@/lib/auth';

// The name and email form arrives with Complete profile, case 1 (issue #4).
export function CompleteProfilePage() {
  const { data: user } = useMe();
  const logout = useLogout();

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Complete your profile</CardTitle>
          <CardDescription>
            Welcome, {user?.name}. Add and verify your email address before an admin can approve
            your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="ghost" onClick={() => logout.mutate()} disabled={logout.isPending}>
            Log out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
