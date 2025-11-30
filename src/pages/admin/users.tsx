import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Navigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { useAdminUsers } from '@/lib/users/hooks';
import { LoadingPage } from '@/components/loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Shield, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

export function AdminUsers() {
  const { user, isAdmin } = useAuth();
  const { adminUsers, loading, removeAdmin, addAdmin } = useAdminUsers();
  const [newAdminUserId, setNewAdminUserId] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleRemoveAdmin = async (userId: string) => {
    // Prevent removing last admin
    if (adminUsers.length === 1) {
      toast.error('Cannot remove the last admin user');
      return;
    }

    // Prevent removing yourself
    if (userId === user.id) {
      toast.error('You cannot remove your own admin privileges');
      return;
    }

    if (confirm('Are you sure you want to remove admin privileges from this user?')) {
      const success = await removeAdmin(userId);
      if (success) {
        toast.success('Admin privileges removed');
      } else {
        toast.error('Failed to remove admin privileges');
      }
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminUserId.trim()) {
      toast.error('Please enter a user ID');
      return;
    }

    setIsAdding(true);
    const success = await addAdmin(newAdminUserId.trim());
    if (success) {
      toast.success('Admin added successfully');
      setNewAdminUserId('');
    } else {
      toast.error('Failed to add admin. User may already be an admin or does not exist.');
    }
    setIsAdding(false);
  };

  if (loading) {
    return <LoadingPage />;
  }

  return (
    <PageLayout>
      <PageHeader
        title="Admin User Management"
        description="Manage admin privileges for users"
      />

      <div className="space-y-6">
        {/* Add Admin Form */}
        <Card>
          <CardHeader>
            <CardTitle>Add New Admin</CardTitle>
            <CardDescription>
              Grant admin privileges to a user by entering their user ID. You can find user IDs in your Supabase auth dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddAdmin} className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="userId" className="sr-only">
                  User ID
                </Label>
                <Input
                  id="userId"
                  type="text"
                  placeholder="User ID (UUID)"
                  value={newAdminUserId}
                  onChange={(e) => setNewAdminUserId(e.target.value)}
                  disabled={isAdding}
                  required
                />
              </div>
              <Button type="submit" disabled={isAdding}>
                <Plus className="h-4 w-4 mr-2" />
                {isAdding ? 'Adding...' : 'Add Admin'}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-2">
              Current user ID: <code className="bg-muted px-1 rounded">{user.id}</code>
            </p>
          </CardContent>
        </Card>

        {/* Admin Users List */}
        <Card>
          <CardHeader>
            <CardTitle>Current Admins</CardTitle>
            <CardDescription>
              {adminUsers.length} admin user{adminUsers.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No admin users found
                    </TableCell>
                  </TableRow>
                ) : (
                  adminUsers.map((adminUser) => (
                    <TableRow key={adminUser.user_id}>
                      <TableCell className="font-medium font-mono text-xs">
                        {adminUser.user_id}
                        {adminUser.user_id === user.id && (
                          <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {adminUser.created_at
                          ? new Date(adminUser.created_at).toLocaleDateString()
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-blue-500">
                          <Shield className="h-3 w-3 mr-1" />
                          Admin
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveAdmin(adminUser.user_id)}
                          disabled={adminUser.user_id === user.id}
                          className="flex items-center gap-1 ml-auto text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
