import { useAuth } from '@/contexts/auth-context';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { useUsers } from '@/lib/users/hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Shield, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';

export function AdminUsers() {
  const { user } = useAuth();
  const { users, loading, toggleAdmin } = useUsers();

  const handleToggleAdmin = async (userId: string, currentIsAdmin: boolean) => {
    // Prevent removing last admin
    const adminCount = users.filter(u => u.isAdmin).length;
    if (currentIsAdmin && adminCount === 1) {
      toast.error('Cannot remove the last admin user');
      return;
    }

    // Prevent toggling your own admin status
    if (userId === user.id) {
      toast.error('You cannot change your own admin privileges');
      return;
    }

    const action = currentIsAdmin ? 'remove admin privileges from' : 'grant admin privileges to';
    if (confirm(`Are you sure you want to ${action} this user?`)) {
      const success = await toggleAdmin(userId, !currentIsAdmin);
      if (success) {
        toast.success(
          currentIsAdmin
            ? 'Admin privileges removed'
            : 'Admin privileges granted'
        );
      } else {
        toast.error('Failed to update admin status');
      }
    }
  };

  if (loading) {
    return <LoadingPage />;
  }

  const adminCount = users.filter(u => u.isAdmin).length;
  const regularCount = users.length - adminCount;

  return (
    <PageLayout>
      <PageHeader
        title="User Management"
        description="Manage users and admin privileges"
      />

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            {users.length} total user{users.length !== 1 ? 's' : ''}
            ({adminCount} admin{adminCount !== 1 ? 's' : ''}, {regularCount} regular user{regularCount !== 1 ? 's' : ''})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((userItem) => (
                  <TableRow key={userItem.id}>
                    <TableCell className="font-medium">
                      {userItem.email}
                      {userItem.id === user.id && (
                        <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(userItem.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {userItem.isAdmin ? (
                        <Badge className="bg-blue-500">
                          <Shield className="h-3 w-3 mr-1" />
                          Admin
                        </Badge>
                      ) : (
                        <Badge variant="secondary">User</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={userItem.isAdmin ? 'destructive' : 'default'}
                        onClick={() => handleToggleAdmin(userItem.id, userItem.isAdmin)}
                        disabled={userItem.id === user.id}
                        className="flex items-center gap-1 ml-auto"
                      >
                        {userItem.isAdmin ? (
                          <>
                            <ShieldOff className="h-4 w-4" />
                            Remove Admin
                          </>
                        ) : (
                          <>
                            <Shield className="h-4 w-4" />
                            Make Admin
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
