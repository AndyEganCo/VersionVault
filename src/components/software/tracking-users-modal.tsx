import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTrackingUsers } from '@/lib/software/hooks/tracking-hooks';
import { Search, X } from 'lucide-react';

interface TrackingUsersModalProps {
  softwareId: string | null;
  softwareName: string;
  onClose: () => void;
}

export function TrackingUsersModal({ softwareId, softwareName, onClose }: TrackingUsersModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const { users, loading, fetchUsers, toggleTracking } = useTrackingUsers(softwareId);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (softwareId) {
      fetchUsers();
    }
  }, [softwareId, fetchUsers]);

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.display_name?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const handleToggleTracking = async (userId: string, isTracking: boolean) => {
    setTogglingUserId(userId);
    await toggleTracking(userId, isTracking);
    setTogglingUserId(null);
  };

  return (
    <Dialog open={!!softwareId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{softwareName} - User Tracking</DialogTitle>
        </DialogHeader>

        <div className="flex justify-end mb-4">
          {showSearch ? (
            <div className="relative flex items-center">
              <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 w-64"
                autoFocus
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 h-6 w-6"
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery('');
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSearch(true)}
            >
              <Search className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-auto border rounded-md">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading users...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {searchQuery ? 'No users found matching your search' : 'No users found'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>{user.display_name || '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant={user.is_tracking ? 'outline' : 'default'}
                        size="sm"
                        onClick={() => handleToggleTracking(user.user_id, user.is_tracking)}
                        disabled={togglingUserId === user.user_id}
                      >
                        {user.is_tracking ? 'Untrack' : 'Track'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
