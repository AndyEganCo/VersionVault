import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getVersionHistory } from "@/lib/software/api/api";
import { formatDate } from "@/lib/date";
import type { VersionHistory } from "@/lib/software/types";

type ReleaseNotesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  softwareName: string;
  softwareId: string;
};

export function ReleaseNotesDialog({
  open,
  onOpenChange,
  softwareName,
  softwareId,
}: ReleaseNotesDialogProps) {
  const [versionHistory, setVersionHistory] = useState<VersionHistory[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadVersionHistory() {
      if (open && softwareId) {
        setLoading(true);
        try {
          const history = await getVersionHistory(softwareId, softwareName);
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
  }, [open, softwareId, softwareName]);

  const selectedNotes = versionHistory.find(v => v.version === selectedVersion);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[90vw] h-[90vh] flex flex-col p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{softwareName} Release Notes</DialogTitle>
          <DialogDescription className="sr-only">
            Version history and release notes for {softwareName}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center h-20">
            Loading release notes...
          </div>
        ) : versionHistory.length > 0 ? (
          <>
            <div className="mb-4 flex-shrink-0">
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
                      {`Version ${version.version}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="pr-4 pb-4">
                  {selectedNotes && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold">
                            Version {selectedNotes.version}
                          </h3>
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
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-20">
            No release notes available
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}