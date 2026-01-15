import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUserSoftwareTracking } from '@/lib/software/hooks/tracking-hooks';
import { Search, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

type SortField = 'software_name' | 'category' | 'is_tracking';
type SortDirection = 'asc' | 'desc';

interface UserSoftwareModalProps {
  userId: string | null;
  userEmail: string;
  onClose: () => void;
}

export function UserSoftwareModal({ userId, userEmail, onClose }: UserSoftwareModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const { software, loading, fetchSoftware, toggleTracking } = useUserSoftwareTracking(userId);
  const [togglingSoftwareId, setTogglingSoftwareId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('software_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    if (userId) {
      fetchSoftware();
    }
  }, [userId, fetchSoftware]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(current => current === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredSoftware = software
    .filter(item =>
      item.software_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;

      if (sortField === 'software_name') {
        comparison = a.software_name.localeCompare(b.software_name);
      } else if (sortField === 'category') {
        comparison = a.category.localeCompare(b.category);
      } else if (sortField === 'is_tracking') {
        // Sort tracked software first (true > false)
        comparison = a.is_tracking === b.is_tracking ? 0 : a.is_tracking ? -1 : 1;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const handleToggleTracking = async (softwareId: string, isTracking: boolean) => {
    setTogglingSoftwareId(softwareId);
    await toggleTracking(softwareId, isTracking);
    setTogglingSoftwareId(null);
  };

  return (
    <Dialog open={!!userId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{userEmail} - Software Tracking</DialogTitle>
        </DialogHeader>

        <div className="flex justify-end mb-4">
          {showSearch ? (
            <div className="relative flex items-center">
              <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search software..."
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
              Loading software...
            </div>
          ) : filteredSoftware.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {searchQuery ? 'No software found matching your search' : 'No software found'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('software_name')}
                      className={sortField === 'software_name' ? 'text-primary font-medium' : ''}
                    >
                      Software
                      {sortField === 'software_name' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="ml-2 h-4 w-4" />
                        ) : (
                          <ArrowDown className="ml-2 h-4 w-4" />
                        )
                      ) : (
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('category')}
                      className={sortField === 'category' ? 'text-primary font-medium' : ''}
                    >
                      Category
                      {sortField === 'category' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="ml-2 h-4 w-4" />
                        ) : (
                          <ArrowDown className="ml-2 h-4 w-4" />
                        )
                      ) : (
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('is_tracking')}
                      className={sortField === 'is_tracking' ? 'text-primary font-medium' : ''}
                    >
                      Tracking
                      {sortField === 'is_tracking' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="ml-2 h-4 w-4" />
                        ) : (
                          <ArrowDown className="ml-2 h-4 w-4" />
                        )
                      ) : (
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      )}
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSoftware.map((item) => (
                  <TableRow key={item.software_id}>
                    <TableCell className="font-medium">{item.software_name}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant={item.is_tracking ? 'outline' : 'default'}
                        size="sm"
                        onClick={() => handleToggleTracking(item.software_id, item.is_tracking)}
                        disabled={togglingSoftwareId === item.software_id}
                      >
                        {item.is_tracking ? 'Untrack' : 'Track'}
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
