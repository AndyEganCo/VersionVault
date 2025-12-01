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
import { Pencil, Trash2, Check, FileText, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, RefreshCw } from 'lucide-react';
import { EditSoftwareDialog } from './edit-software-dialog';
import { DeleteSoftwareDialog } from './delete-software-dialog';
import type { Software } from '@/lib/software/types';
import { updateSoftware } from '@/lib/software/admin';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date';
import { ReleaseNotesDialog } from './release-notes-dialog';
import { extractSoftwareInfo } from '@/lib/ai/extract-software-info';
import { versionCheckLimiter } from '@/lib/utils/rate-limiter';

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
  const [checkingVersion, setCheckingVersion] = useState<Set<string>>(new Set());
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

      await onUpdate();
      toast.success('Last checked date updated');
    } catch (error) {
      console.error('Error updating last checked date:', error);
      toast.error('Failed to update last checked date');
    }
  };

  const handleCheckVersion = async (software: Software) => {
    if (!software.version_website) {
      toast.error('No version website configured for this software');
      return;
    }

    // Check rate limit
    if (!versionCheckLimiter.isAllowed(software.id)) {
      const timeRemaining = versionCheckLimiter.getTimeRemaining(software.id);
      toast.error(`Please wait ${timeRemaining} seconds before checking this version again`);
      return;
    }

    // Add to checking set
    setCheckingVersion(prev => new Set(prev).add(software.id));
    const loadingToast = toast.loading(`Checking version for ${software.name}...`);

    try {
      // Extract version info using AI
      const extracted = await extractSoftwareInfo(
        software.name,
        software.website,
        software.version_website,
        `Current version: ${software.current_version || 'unknown'}`
      );

      // Update software with new version info
      await updateSoftware(software.id, {
        current_version: extracted.currentVersion || software.current_version,
        release_date: extracted.releaseDate || software.release_date,
        last_checked: new Date().toISOString()
      });

      await onUpdate();

      // Show appropriate message based on results
      if (extracted.isJavaScriptPage && extracted.lowContentWarning) {
        // JavaScript page warning - show special message
        toast.warning(
          `⚠️ JavaScript Page Detected\n\n${extracted.lowContentWarning}\n\n${extracted.currentVersion ? `Found version: ${extracted.currentVersion} (may be inaccurate)` : 'No version found'}`,
          { id: loadingToast, duration: 10000 }
        );
      } else if (extracted.currentVersion) {
        // Success - version found
        toast.success(
          `Version check complete!\nVersion: ${extracted.currentVersion}${extracted.releaseDate ? `\nReleased: ${extracted.releaseDate}` : ''}`,
          { id: loadingToast, duration: 5000 }
        );
      } else {
        // No version found (non-JS page)
        toast.warning('Version check complete, but no version found on the page', { id: loadingToast });
      }
    } catch (error) {
      console.error('Error checking version:', error);
      toast.error('Failed to check version. Please try again.', { id: loadingToast });
    } finally {
      // Remove from checking set
      setCheckingVersion(prev => {
        const newSet = new Set(prev);
        newSet.delete(software.id);
        return newSet;
      });
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
              <TableHead className="text-right w-[160px]">Actions</TableHead>
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
                <TableCell className="text-right flex justify-end items-center gap-1">
                  {software.version_website && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        title="Open version webpage"
                      >
                        <a
                          href={software.version_website}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCheckVersion(software)}
                        disabled={checkingVersion.has(software.id)}
                        title="Check for new version"
                      >
                        <RefreshCw className={`h-4 w-4 ${checkingVersion.has(software.id) ? 'animate-spin' : ''}`} />
                      </Button>
                    </>
                  )}
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