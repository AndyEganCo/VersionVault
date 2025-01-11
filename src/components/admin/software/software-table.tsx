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
import { Pencil, Trash2, Check, FileText, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { EditSoftwareDialog } from './edit-software-dialog';
import { DeleteSoftwareDialog } from './delete-software-dialog';
import type { Software } from '@/lib/software/types';
import { updateSoftware } from '@/lib/software/api';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date';
import { ReleaseNotesDialog } from './release-notes-dialog';

type SoftwareTableProps = {
  data: Software[];
  loading: boolean;
  onUpdate: () => Promise<void>;
};

type SortField = 'name' | 'category' | 'manufacturer' | 'current_version' | 'release_date' | 'last_checked';
type SortDirection = 'asc' | 'desc';

function SortButton({ field, label, currentSort, onSort }: {
  field: SortField;
  label: string;
  currentSort: { field: SortField; direction: SortDirection };
  onSort: (field: SortField) => void;
}) {
  const isActive = currentSort.field === field;
  
  return (
    <Button 
      variant="ghost" 
      onClick={() => onSort(field)}
      className={isActive ? 'text-primary font-medium' : ''}
    >
      {label}
      {isActive ? (
        currentSort.direction === 'asc' ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : (
          <ArrowDown className="ml-2 h-4 w-4" />
        )
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4" />
      )}
    </Button>
  );
}

export function SoftwareTable({ data, loading, onUpdate }: SoftwareTableProps) {
  const [editingSoftware, setEditingSoftware] = useState<Software | null>(null);
  const [deletingSoftware, setDeletingSoftware] = useState<Software | null>(null);
  const [addingNotesTo, setAddingNotesTo] = useState<Software | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(current => current === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];

    if (!aValue && !bValue) return 0;
    if (!aValue) return 1;
    if (!bValue) return -1;

    const comparison = aValue < bValue ? -1 : 1;
    return sortDirection === 'asc' ? comparison : -comparison;
  });

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
              <TableHead>
                <SortButton 
                  field="name"
                  label="Name"
                  currentSort={{ field: sortField, direction: sortDirection }}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead>
                <SortButton 
                  field="category"
                  label="Category"
                  currentSort={{ field: sortField, direction: sortDirection }}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead>
                <SortButton 
                  field="manufacturer"
                  label="Manufacturer"
                  currentSort={{ field: sortField, direction: sortDirection }}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead>
                <SortButton 
                  field="current_version"
                  label="Version"
                  currentSort={{ field: sortField, direction: sortDirection }}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead>
                <SortButton 
                  field="release_date"
                  label="Release Date"
                  currentSort={{ field: sortField, direction: sortDirection }}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead>
                <SortButton 
                  field="last_checked"
                  label="Last Checked"
                  currentSort={{ field: sortField, direction: sortDirection }}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((software) => (
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