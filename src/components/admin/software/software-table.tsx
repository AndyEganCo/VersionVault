import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Check, FileText } from 'lucide-react';
import { EditSoftwareDialog } from './edit-software-dialog';
import { DeleteSoftwareDialog } from './delete-software-dialog';
import type { Software } from '@/lib/software/types';
import { Input } from '@/components/ui/input';
import { updateSoftware } from '@/lib/software/api';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date';
import { ReleaseNotesDialog } from './release-notes-dialog';

type SoftwareTableProps = {
  data: Software[];
  loading: boolean;
  onUpdate: () => Promise<void>;
};

export function SoftwareTable({ data, loading, onUpdate }: SoftwareTableProps) {
  const [editingSoftware, setEditingSoftware] = useState<Software | null>(null);
  const [deletingSoftware, setDeletingSoftware] = useState<Software | null>(null);
  const [addingNotesTo, setAddingNotesTo] = useState<Software | null>(null);

  const handleUpdateLastChecked = async (software: Software) => {
    try {
      const now = new Date().toISOString();
      await updateSoftware(software.id, {
        last_checked: now
      });
      
      // Refresh the data immediately after update
      await onUpdate();
      toast.success('Last checked date updated');
    } catch (error) {
      toast.error('Failed to update last checked date');
      console.error('Error updating last checked date:', error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Manufacturer</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Release Date</TableHead>
              <TableHead>Last Checked</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((software) => (
              <TableRow key={software.id}>
                <TableCell className="font-medium">{software.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{software.category}</Badge>
                </TableCell>
                <TableCell>{software.manufacturer}</TableCell>
                <TableCell>
                  {software.current_version || 'N/A'}
                </TableCell>
                <TableCell>
                  {software.release_date ? formatDate(software.release_date) : 'N/A'}
                </TableCell>
                <TableCell className="space-x-2">
                  <span>{software.last_checked ? formatDate(software.last_checked) : 'Never'}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleUpdateLastChecked(software)}
                    title="Mark as checked today"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setAddingNotesTo(software)}
                    disabled={!software.current_version}
                    title="Add release notes"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingSoftware(software)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeletingSoftware(software)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editingSoftware && (
        <EditSoftwareDialog
          software={editingSoftware}
          open={!!editingSoftware}
          onOpenChange={(open) => !open && setEditingSoftware(null)}
          onSuccess={onUpdate}
        />
      )}

      {deletingSoftware && (
        <DeleteSoftwareDialog
          software={deletingSoftware}
          open={!!deletingSoftware}
          onOpenChange={(open) => !open && setDeletingSoftware(null)}
          onSuccess={onUpdate}
        />
      )}

      {addingNotesTo && (
        <ReleaseNotesDialog
          software={addingNotesTo}
          open={!!addingNotesTo}
          onOpenChange={(open) => !open && setAddingNotesTo(null)}
          onSuccess={onUpdate}
        />
      )}
    </>
  );
}