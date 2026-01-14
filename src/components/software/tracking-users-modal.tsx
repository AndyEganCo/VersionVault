import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTrackingUsers } from '@/lib/software/hooks/tracking-hooks';
import { formatDate } from '@/lib/date';
import { Search, UserPlus } from 'lucide-react';

interface TrackingUsersModalProps {
  softwareId: string | null;
  softwareName: string;
  onClose: () => void;
}

export function TrackingUsersModal({ softwareId, softwareName, onClose }: TrackingUsersModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { users, loading, fetchUsers, trackForUser } = useTrackingUsers(softwareId);
  const [trackingUserId, setTrackingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (softwareId) {
      fetchUsers();
    }
  }, [softwareId, fetchUsers]);

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTrackForUser = async (userId: string) => {
    setTrackingUserId(userId);
    await trackForUser(userId);
    setTrackingUserId(null);
  };

  return (
    <Dialog open={!!softwareId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Users Tracking {softwareName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* User List */}
          <div className="flex-1 overflow-auto border rounded-md">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">
                Loading users...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {searchQuery ? 'No users found matching your search' : 'No users tracking this software yet'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tracking Since</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>{user.display_name || '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {user.is_admin && <Badge variant="default">Admin</Badge>}
                          {user.is_premium && <Badge variant="secondary">Premium</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(user.tracked_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Add user section */}
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">
              To track this software for a user, search for their email above and they will be added to the tracking list.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
