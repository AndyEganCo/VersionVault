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
import { updateSoftware } from '@/lib/software/api/admin';
import { toast } from 'sonner';
import { addVersionHistory, shouldPerformWebSearch } from '@/lib/software/api/api';
import { formatDate } from '@/lib/date';
import { ReleaseNotesDialog } from './release-notes-dialog';
import { extractSoftwareInfo } from '@/lib/ai/extract-software-info';
import { versionCheckLimiter } from '@/lib/utils/rate-limiter';
import { breakPhonePattern } from '@/lib/utils/version-display';

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
    const loadingToast = toast.loading(`Extracting version info for ${software.name}...`);

    try {
      // Extract version info (now includes ALL versions in the versions array)
      const extracted = await extractSoftwareInfo(
        software.name,
        software.website,
        software.version_website,
        `Checking for latest version`,
        software.source_type,
        software.forum_config,
        software.scraping_strategy
      );

      // Update software with last_checked timestamp
      // NOTE: We DO NOT update current_version here anymore.
      // Current version is computed from software_version_history table.
      await updateSoftware(software.id, {
        last_checked: new Date().toISOString()
      });

      // Save ALL versions to database if available
      let savedCount = 0;
      let versionsNeedingSearch: any[] = [];
      let versionsToSkip: any[] = [];

      if (extracted.versions && extracted.versions.length > 0) {
        // Smart selection: Search up to 2 versions that need enhancement
        // Priority: Latest versions first, then fill in gaps in older versions

        for (const version of extracted.versions) {
          if (versionsNeedingSearch.length < 2) {
            // Check if this version needs web search
            const needsSearch = await shouldPerformWebSearch(software.id, version.version);
            if (needsSearch) {
              versionsNeedingSearch.push(version);
            } else {
              versionsToSkip.push(version);
              console.log(`⏭️ Version ${version.version} already has good notes, will check next version`);
            }
          } else {
            // Already have 2 to search, add rest to skip list
            versionsToSkip.push(version);
          }
        }

        console.log(`📊 Search plan: ${versionsNeedingSearch.length} to enhance, ${versionsToSkip.length} to skip`);

        // Process versions that need web search enhancement (in parallel!)
        const enhancementPromises = versionsNeedingSearch.map(async (version) => {
          // These versions definitely need search (already checked above)
          let enhancedNotes = version.notes;
          let structuredNotes = undefined;
          let searchSources = undefined;
          let enhancedReleaseDate = version.releaseDate; // Start with extracted date

          console.log(`🔍 Performing web search for ${version.version}...`);

          // Call enhanced extraction edge function for better notes
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 180000); // 180 second timeout for web search (increased from 120s)

            const enhancedResult = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-with-web-search`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({
                  softwareName: software.name,
                  manufacturer: software.manufacturer || 'Unknown',
                  version: version.version,
                  websiteUrl: software.version_website || software.website,
                  additionalDomains: []
                }),
                signal: controller.signal
              }
            );

            clearTimeout(timeoutId);

            if (enhancedResult.ok) {
              const enhanced = await enhancedResult.json();
              console.log('✅ Web search response for', version.version, ':', enhanced);
              if (enhanced.raw_notes && enhanced.raw_notes.length > 0) {
                enhancedNotes = enhanced.raw_notes.join('\n');
                structuredNotes = enhanced.structured_notes;
                searchSources = enhanced.sources;
                // Use web search release date if found, otherwise keep original
                if (enhanced.release_date) {
                  enhancedReleaseDate = enhanced.release_date;
                  console.log('📅 Found release date:', enhanced.release_date);
                }
                console.log('📝 Using enhanced notes for', version.version, '- sources:', searchSources?.length || 0);
              } else {
                console.log('⚠️ Web search returned empty notes for', version.version);
              }
            } else {
              const errorText = await enhancedResult.text();
              console.error('❌ Web search HTTP error for', version.version, ':', enhancedResult.status, errorText);
            }
          } catch (error) {
            console.error('❌ Web search extraction failed for', version.version, ':', error);
            // Fall back to basic notes - no error shown to user
          }

          return {
            version: version.version,
            releaseDate: enhancedReleaseDate, // Use enhanced date if found via web search
            notes: enhancedNotes,
            type: version.type,
            structuredNotes,
            searchSources
          };
        });

        // Wait for all web searches to complete in parallel
        const enhancedVersions = await Promise.all(enhancementPromises);

        // Save enhanced versions to database
        for (const versionData of enhancedVersions) {
          const success = await addVersionHistory(software.id, {
            software_id: software.id,
            version: versionData.version,
            release_date: versionData.releaseDate,
            notes: versionData.notes,
            type: versionData.type,
            notes_source: 'auto', // Mark as auto-generated
            structured_notes: versionData.structuredNotes,
            search_sources: versionData.searchSources
          });

          if (success) {
            savedCount++;
          }
        }

        // Process skipped versions WITHOUT web search (already have good notes or not priority)
        for (const version of versionsToSkip) {
          const success = await addVersionHistory(software.id, {
            software_id: software.id,
            version: version.version,
            release_date: version.releaseDate,
            notes: version.notes,
            type: version.type,
            notes_source: 'auto'
          });

          if (success) {
            savedCount++;
          }
        }
      }

      await onUpdate();

      // Show appropriate message
      if (savedCount > 0) {
        // Successfully extracted multiple versions
        const searchCount = versionsNeedingSearch?.length || 0;
        const skipCount = versionsToSkip?.length || 0;

        let message = `✅ Version extraction complete!\n\n`;
        message += `Found and saved ${savedCount} version${savedCount > 1 ? 's' : ''}\n`;
        if (searchCount > 0) {
          message += `🔍 Enhanced ${searchCount} with web search\n`;
        }
        if (skipCount > 0) {
          message += `💰 Skipped ${skipCount} (already have good notes)`;
        }

        toast.success(message, { id: loadingToast, duration: 7000 });
      } else if (extracted.currentVersion) {
        // Only got latest version, no full version history
        if (extracted.isJavaScriptPage && extracted.lowContentWarning) {
          toast.warning(
            `⚠️ JavaScript Page Detected\n\n${extracted.lowContentWarning}\n\nFound version: ${extracted.currentVersion}`,
            { id: loadingToast, duration: 10000 }
          );
        } else {
          toast.success(
            `Version check complete!\nVersion: ${extracted.currentVersion}${extracted.releaseDate ? `\nReleased: ${extracted.releaseDate}` : ''}`,
            { id: loadingToast, duration: 5000 }
          );
        }
      } else {
        // No versions found at all
        toast.warning('No versions found on the page. Try a different URL or check manually.', { id: loadingToast });
      }
    } catch (error) {
      console.error('Error checking version:', error);
      toast.error('Failed to extract versions. Please try again.', { id: loadingToast });

      // Still update last_checked
      await updateSoftware(software.id, {
        last_checked: new Date().toISOString()
      });
      await onUpdate();
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
                  {software.current_version ? breakPhonePattern(software.current_version) : 'N/A'}
                </TableCell>
                <TableCell>
                  {formatDate(software.release_date || software.last_checked || software.created_at)}
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
                    title="Add or edit release notes"
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