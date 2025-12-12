import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getVersionHistory } from '@/lib/software/api/api';
import { toggleSoftwareTracking } from '@/lib/software/utils/tracking';
import { formatDate, formatRelativeDate } from '@/lib/date';
import { useAuth } from '@/contexts/auth-context';
import { toast } from 'sonner';
import type { Software, VersionHistory } from '@/lib/software/types';
import { ExternalLink } from 'lucide-react';
import { breakPhonePattern } from '@/lib/utils/version-display';

interface SoftwareDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  software: Software;
  isTracked?: boolean;
  onTrackingChange?: (tracked: boolean) => void;
}

export function SoftwareDetailModal({
  open,
  onOpenChange,
  software,
  isTracked = false,
  onTrackingChange,
}: SoftwareDetailModalProps) {
  const { user } = useAuth();
  const [versionHistory, setVersionHistory] = useState<VersionHistory[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tracked, setTracked] = useState(isTracked);
  const [trackingLoading, setTrackingLoading] = useState(false);

  useEffect(() => {
    setTracked(isTracked);
  }, [isTracked]);

  useEffect(() => {
    async function loadVersionHistory() {
      if (open && software.id) {
        setLoading(true);
        try {
          const history = await getVersionHistory(software.id);
          const validHistory = (history as VersionHistory[]).filter(v => v && v.version);
          setVersionHistory(validHistory);
          setSelectedVersion(validHistory[0]?.version || null);
        } catch (error) {
          console.error('Error loading version history:', error);
        } finally {
          setLoading(false);
        }
      }
    }
    loadVersionHistory();
  }, [open, software.id]);

  const selectedNotes = versionHistory.find(v => v.version === selectedVersion);

  // Get the current version's release info for the top-level "Released" field
  const currentVersionInfo = versionHistory.find(v => v.version === software.current_version);
  const currentVersionDate = currentVersionInfo?.release_date || currentVersionInfo?.detected_at;

  const handleTrackingChange = async (checked: boolean) => {
    if (!user) {
      toast.error('Please sign in to track software');
      return;
    }

    setTrackingLoading(true);
    try {
      const success = await toggleSoftwareTracking(user.id, software.id, checked);
      if (success) {
        setTracked(checked);
        onTrackingChange?.(checked);
        toast.success(checked ? 'Software tracked' : 'Software untracked');
      }
    } finally {
      setTrackingLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] flex flex-col p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-2xl">{software.name}</DialogTitle>
          <DialogDescription>
            by {software.manufacturer}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-hidden">
          <div className="pr-4 space-y-6">
            {/* Software Info Section */}
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{software.category}</Badge>
                {software.current_version && (
                  <Badge variant="outline">{breakPhonePattern(software.current_version)}</Badge>
                )}
              </div>

              <div className="space-y-3 text-sm">
                {software.current_version && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Version</span>
                    <span className="font-medium">{breakPhonePattern(software.current_version)}</span>
                  </div>
                )}

                {software.last_checked && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Checked</span>
                    <span>{formatRelativeDate(software.last_checked)}</span>
                  </div>
                )}

                {currentVersionDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Released</span>
                    <span>{formatDate(currentVersionDate)}</span>
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                className="w-full"
                asChild
              >
                <a
                  href={software.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2"
                >
                  Visit Website
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>

            {/* Tracking Section */}
            {user && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Track Updates</span>
                  <Switch
                    checked={tracked}
                    onCheckedChange={handleTrackingChange}
                    disabled={trackingLoading}
                  />
                </div>
              </div>
            )}

            {/* Release Notes Section */}
            {versionHistory.length > 0 && (
              <div className="border-t pt-4 space-y-4">
                <h3 className="font-semibold">Release Notes</h3>

                <Select
                  value={selectedVersion || undefined}
                  onValueChange={setSelectedVersion}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent>
                    {versionHistory.map((version, index) => (
                      <SelectItem
                        key={version.id ? `version-${version.id}` : `version-${version.version}-${index}`}
                        value={version.version}
                      >
                        {`Version ${breakPhonePattern(version.version)}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-muted-foreground">Loading release notes...</p>
                  </div>
                ) : selectedNotes ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">
                        Version {breakPhonePattern(selectedNotes.version)}
                      </h4>
                      <Badge variant={
                        selectedNotes.type === 'major' ? 'default' :
                        selectedNotes.type === 'minor' ? 'secondary' : 'outline'
                      }>
                        {selectedNotes.type}
                      </Badge>
                    </div>
                    {(selectedNotes.release_date || selectedNotes.detected_at) && (
                      <p className="text-sm text-muted-foreground">
                        {formatDate(selectedNotes.release_date || selectedNotes.detected_at)}
                      </p>
                    )}
                    <ul className="list-disc list-inside space-y-1">
                      {Array.isArray(selectedNotes.notes) ?
                        selectedNotes.notes.map((item, i) => (
                          <li key={`note-${selectedNotes.version}-${i}`} className="text-sm">
                            {item}
                          </li>
                        )) : (
                          <li className="text-sm">{selectedNotes.notes}</li>
                        )
                      }
                    </ul>
                  </div>
                ) : null}
              </div>
            )}

            {versionHistory.length === 0 && !loading && (
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground text-center py-4">
                  No release notes available yet
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
