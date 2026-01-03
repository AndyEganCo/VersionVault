import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { addVersionHistory, getVersionHistory, deleteVersionHistory } from '@/lib/software/api/api';
import type { Software } from '@/lib/software/types';
import { Plus, Upload, Link as LinkIcon, Loader2, Check, X, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { extractVersionsFromURL, extractVersionsFromPDF, type ExtractedVersion } from '@/lib/software/release-notes/extractor';
import { parsePDFFile } from '@/lib/software/release-notes/pdf-parser';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { breakPhonePattern } from '@/lib/utils/version-display';

interface ReleaseNotesDialogProps {
  software: Software;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void>;
}

function formatDateForInput(date: string): string {
  // Return YYYY-MM-DD format for HTML5 date input
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function convertDateInputToUTC(dateString: string): string {
  // Convert YYYY-MM-DD to UTC ISO string without timezone shift
  // Input: "2025-12-28" -> Output: "2025-12-28T00:00:00.000Z"
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString();
}

function convertToUTCDate(dateString: string): string {
  // Handle various date formats and convert to UTC without timezone shift
  // If it's YYYY-MM-DD format, use our safe converter
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return convertDateInputToUTC(dateString);
  }
  // Otherwise parse it and extract the date components to preserve the date
  const d = new Date(dateString);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();
  return new Date(Date.UTC(year, month, day)).toISOString();
}

export function ReleaseNotesDialog({
  software,
  open,
  onOpenChange,
  onSuccess
}: ReleaseNotesDialogProps) {
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<string>('');
  const [type, setType] = useState<'major' | 'minor' | 'patch'>('minor');
  const [versionHistory, setVersionHistory] = useState<Array<{id: string, version: string, notes: any, type: string, release_date: string}>>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>('current');
  const [newVersion, setNewVersion] = useState('');
  const [releaseDate, setReleaseDate] = useState(formatDateForInput(new Date().toISOString()));
  const [deleting, setDeleting] = useState(false);

  // Bulk import states
  const [bulkImportUrl, setBulkImportUrl] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractedVersions, setExtractedVersions] = useState<ExtractedVersion[]>([]);
  const [selectedVersions, setSelectedVersions] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadVersionHistory() {
      if (open && software.id) {
        const history = await getVersionHistory(software.id);

        // Filter out any entries with invalid data to prevent rendering crashes
        const validHistory = history.filter(entry =>
          entry &&
          entry.id &&
          entry.version &&
          typeof entry.version === 'string' &&
          entry.version.trim().length > 0
        );

        setVersionHistory(validHistory);

        // Set selected version to current by default
        setSelectedVersion('current');

        const currentVersionEntry = validHistory.find(
          entry => entry.version === software.current_version
        );

        if (currentVersionEntry) {
          setType(currentVersionEntry.type);
          const noteText = Array.isArray(currentVersionEntry.notes)
            ? currentVersionEntry.notes.join('\n')
            : (currentVersionEntry.notes || '');
          setNotes(noteText);
          if (currentVersionEntry.release_date) {
            setReleaseDate(formatDateForInput(currentVersionEntry.release_date));
          }
        } else {
          setType('minor');
          setNotes('');
          setReleaseDate(formatDateForInput(new Date().toISOString()));
        }
        setNewVersion('');
      }
    }
    loadVersionHistory();
  }, [open, software.id, software.current_version]);

  const handleVersionChange = (value: string) => {
    setSelectedVersion(value);

    if (value === 'new') {
      // Creating a new version
      setNotes('');
      setType('minor');
      setReleaseDate(formatDateForInput(new Date().toISOString()));
      setNewVersion('');
    } else if (value === 'current') {
      // Load current version data
      const currentVersionEntry = versionHistory.find(
        entry => entry.version === software.current_version
      );

      if (currentVersionEntry) {
        setType(currentVersionEntry.type as 'major' | 'minor' | 'patch');
        const noteText = Array.isArray(currentVersionEntry.notes)
          ? currentVersionEntry.notes.join('\n')
          : (currentVersionEntry.notes || '');
        setNotes(noteText);
        if (currentVersionEntry.release_date) {
          setReleaseDate(formatDateForInput(currentVersionEntry.release_date));
        }
      }
    } else {
      // Load selected version data from history
      const selectedVersionEntry = versionHistory.find(
        entry => entry.version === value
      );

      if (selectedVersionEntry) {
        setType(selectedVersionEntry.type as 'major' | 'minor' | 'patch');
        const noteText = Array.isArray(selectedVersionEntry.notes)
          ? selectedVersionEntry.notes.join('\n')
          : (selectedVersionEntry.notes || '');
        setNotes(noteText);
        if (selectedVersionEntry.release_date) {
          setReleaseDate(formatDateForInput(selectedVersionEntry.release_date));
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Determine which version to use
      let versionToSave = '';
      if (selectedVersion === 'new') {
        versionToSave = newVersion;
      } else if (selectedVersion === 'current') {
        versionToSave = software.current_version || '';
      } else {
        versionToSave = selectedVersion;
      }

      // releaseDate is already in YYYY-MM-DD format from the date input
      const success = await addVersionHistory(software.id, {
        software_id: software.id,
        version: versionToSave,
        release_date: convertDateInputToUTC(releaseDate),
        notes: notes,
        type,
        notes_source: 'manual' // Mark as manual when edited through UI
      });

      if (success) {
        onOpenChange(false);
        await onSuccess();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVersion = async () => {
    // Determine the actual version to delete (convert 'current' to actual version number)
    let versionToDelete = selectedVersion;
    if (selectedVersion === 'current') {
      versionToDelete = software.current_version || '';
    }

    // Find the version entry to delete
    const versionEntry = versionHistory.find(v => v.version === versionToDelete);

    if (!versionEntry) {
      toast.error('Version not found');
      return;
    }

    // Confirm deletion
    if (!confirm(`Are you sure you want to delete version ${versionToDelete}? This cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    try {
      const success = await deleteVersionHistory(versionEntry.id);

      if (success) {
        toast.success(`Version ${versionToDelete} deleted successfully`);

        // Reload version history
        const history = await getVersionHistory(software.id);
        setVersionHistory(history);

        // Always navigate to the next available version after deletion
        if (history.length > 0) {
          // Find the index of the deleted version to determine next version
          const deletedIndex = versionHistory.findIndex(v => v.version === versionToDelete);

          // Navigate to the next version down (same index in new history, or previous if at end)
          if (deletedIndex >= 0 && deletedIndex < history.length) {
            setSelectedVersion(history[deletedIndex].version);
          } else if (history.length > 0) {
            // If deleted version was last, go to the new last version
            setSelectedVersion(history[history.length - 1].version);
          }
        } else {
          // No versions left, show new version form
          setSelectedVersion('new');
        }

        await onSuccess();
      } else {
        toast.error('Failed to delete version');
      }
    } catch (error) {
      console.error('Error deleting version:', error);
      toast.error('Failed to delete version');
    } finally {
      setDeleting(false);
    }
  };


  const handleExtractFromURL = async () => {
    if (!bulkImportUrl.trim()) {
      toast.error('Please enter a URL');
      return;
    }

    setExtracting(true);
    try {
      const versions = await extractVersionsFromURL(software.name, bulkImportUrl);
      setExtractedVersions(versions);

      // Select all by default
      const allVersions = new Set(versions.map((_, i) => i.toString()));
      setSelectedVersions(allVersions);

      if (versions.length === 0) {
        toast.warning('No versions found in the provided URL');
      } else {
        toast.success(`Found ${versions.length} versions`);
      }
    } catch (error) {
      console.error('Error extracting from URL:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to extract versions from URL');
    } finally {
      setExtracting(false);
    }
  };

  const handlePDFUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }

    setExtracting(true);
    try {
      const pdfText = await parsePDFFile(file);
      const versions = await extractVersionsFromPDF(software.name, pdfText);
      setExtractedVersions(versions);

      // Select all by default
      const allVersions = new Set(versions.map((_, i) => i.toString()));
      setSelectedVersions(allVersions);

      if (versions.length === 0) {
        toast.warning('No versions found in the PDF');
      } else {
        toast.success(`Found ${versions.length} versions from PDF`);
      }
    } catch (error) {
      console.error('Error parsing PDF:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to parse PDF');
    } finally {
      setExtracting(false);
    }
  };

  const toggleVersionSelection = (index: string) => {
    const newSelected = new Set(selectedVersions);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedVersions(newSelected);
  };

  const toggleVersionExpansion = (index: string) => {
    const newExpanded = new Set(expandedVersions);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedVersions(newExpanded);
  };

  const handleBulkImport = async () => {
    const versionsToImport = extractedVersions.filter((_, i) =>
      selectedVersions.has(i.toString())
    );

    if (versionsToImport.length === 0) {
      toast.error('Please select at least one version to import');
      return;
    }

    setImporting(true);
    try {
      let successCount = 0;
      let failCount = 0;

      for (const version of versionsToImport) {
        try {
          const success = await addVersionHistory(software.id, {
            software_id: software.id,
            version: version.version,
            release_date: convertToUTCDate(version.releaseDate),
            notes: version.notes, // Notes are now a single Markdown string
            type: version.type
          });

          if (success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          console.error(`Error importing version ${version.version}:`, error);
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} version(s)`);
        if (failCount > 0) {
          toast.warning(`Failed to import ${failCount} version(s)`);
        }

        // Reset and close
        setExtractedVersions([]);
        setSelectedVersions(new Set());
        setExpandedVersions(new Set());
        setBulkImportUrl('');
        await onSuccess();
        onOpenChange(false);
      } else {
        toast.error('Failed to import any versions');
      }
    } catch (error) {
      console.error('Error during bulk import:', error);
      toast.error('Failed to import versions');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Version History for {software.name}</DialogTitle>
          <DialogDescription>
            Add release notes manually or import from a URL/PDF
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            <TabsTrigger value="bulk">Bulk Import</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4 mt-4">
            <form id="release-notes-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Version</Label>
            <div className="flex gap-2">
              {selectedVersion === 'new' ? (
                <Input
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                  placeholder="Enter new version number"
                  required
                  className="flex-1"
                />
              ) : (
                <>
                  <Select
                    value={selectedVersion}
                    onValueChange={handleVersionChange}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Only show "current" option if current version exists in history */}
                      {versionHistory.some(v => v.version === software.current_version) && (
                        <SelectItem value="current">
                          {breakPhonePattern(software.current_version || 'Current Version')} (Current)
                        </SelectItem>
                      )}
                      {versionHistory
                        .filter(v => v.version !== software.current_version)
                        // Remove duplicates by version number (keep first occurrence)
                        .filter((v, index, self) =>
                          index === self.findIndex(t => t.version === v.version)
                        )
                        .map((version, index) => (
                          <SelectItem
                            key={`version-${index}-${version.id}`}
                            value={version.version}
                          >
                            {breakPhonePattern(version.version)}
                          </SelectItem>
                        ))}
                      <SelectItem value="new">
                        <div className="flex items-center">
                          <Plus className="h-4 w-4 mr-2" />
                          Create New Version
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {/* Show delete button for all existing versions */}
                  {selectedVersion !== 'new' && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      onClick={handleDeleteVersion}
                      disabled={deleting}
                      title="Delete this version"
                    >
                      {deleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Update Type</Label>
            <Select
              value={type}
              onValueChange={(value: 'major' | 'minor' | 'patch') => setType(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="major">Major</SelectItem>
                <SelectItem value="minor">Minor</SelectItem>
                <SelectItem value="patch">Patch</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Release Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter release notes (one per line)"
              rows={8}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Release Date</Label>
            <Input
              type="date"
              value={releaseDate}
              onChange={(e) => setReleaseDate(e.target.value)}
              required
            />
          </div>
            </form>

            <div className="flex justify-end space-x-2 pt-4 border-t mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                }}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" form="release-notes-form" disabled={loading}>
                {loading ? 'Saving...' : selectedVersion === 'new' ? 'Save New Version' : 'Update Release Notes'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="bulk" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Import from URL</Label>
                <div className="flex gap-2">
                  <Input
                    type="url"
                    placeholder="https://example.com/release-notes"
                    value={bulkImportUrl}
                    onChange={(e) => setBulkImportUrl(e.target.value)}
                    disabled={extracting}
                  />
                  <Button
                    type="button"
                    onClick={handleExtractFromURL}
                    disabled={extracting || !bulkImportUrl.trim()}
                  >
                    {extracting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Extract
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Paste a URL to release notes or changelog page
                </p>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Upload PDF</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".pdf"
                    onChange={handlePDFUpload}
                    disabled={extracting}
                    className="cursor-pointer"
                  />
                  <Upload className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Upload a PDF file containing release notes
                </p>
              </div>

              {extractedVersions.length > 0 && (
                <>
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <Label className="text-base">
                        Extracted Versions ({selectedVersions.size} of {extractedVersions.length} selected)
                      </Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedVersions(new Set(extractedVersions.map((_, i) => i.toString())))}
                        >
                          Select All
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedVersions(new Set())}
                        >
                          Deselect All
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-4">
                      {extractedVersions.map((version, index) => {
                        const indexStr = index.toString();
                        const isExpanded = expandedVersions.has(indexStr);
                        const isSelected = selectedVersions.has(indexStr);

                        return (
                          <div
                            key={index}
                            className={`border rounded-lg transition-colors ${
                              isSelected
                                ? 'bg-primary/10 border-primary'
                                : 'hover:bg-muted'
                            }`}
                          >
                            <div
                              className="p-3 cursor-pointer flex items-start justify-between"
                              onClick={() => toggleVersionSelection(indexStr)}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold">{breakPhonePattern(version.version)}</span>
                                  <Badge variant="secondary">{version.type}</Badge>
                                  <span className="text-sm text-muted-foreground">
                                    {version.releaseDate}
                                  </span>
                                  {version.buildNumber && (
                                    <span className="text-xs text-muted-foreground">
                                      Build: {breakPhonePattern(version.buildNumber)}
                                    </span>
                                  )}
                                </div>
                                {!isExpanded && (
                                  <div className="text-sm text-muted-foreground line-clamp-2">
                                    {version.notes.substring(0, 150)}...
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleVersionExpansion(indexStr);
                                  }}
                                  className="h-6 w-6 p-0"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                                {isSelected ? (
                                  <Check className="h-5 w-5 text-primary" />
                                ) : (
                                  <X className="h-5 w-5 text-muted-foreground" />
                                )}
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="px-3 pb-3 border-t mt-2 pt-3">
                                <div className="prose prose-sm max-w-none dark:prose-invert">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {version.notes}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-4 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setExtractedVersions([]);
                        setSelectedVersions(new Set());
                        setBulkImportUrl('');
                      }}
                      disabled={importing}
                    >
                      Clear
                    </Button>
                    <Button
                      type="button"
                      onClick={handleBulkImport}
                      disabled={importing || selectedVersions.size === 0}
                    >
                      {importing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        `Import ${selectedVersions.size} Version${selectedVersions.size !== 1 ? 's' : ''}`
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
} 