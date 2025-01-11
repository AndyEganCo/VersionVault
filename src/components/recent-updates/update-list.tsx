import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDate } from '@/lib/date';
import type { Software } from '@/lib/software/types';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { ReleaseNotesDialog } from '../software/release-notes/dialog';

export type UpdateListProps = {
  updates: Software[];
  loading: boolean;
};

export function UpdateList({ updates, loading }: UpdateListProps) {
  const navigate = useNavigate();
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const [selectedSoftware, setSelectedSoftware] = useState<Software | null>(null);

  if (loading) {
    return (
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center animate-pulse">
              <div className="h-9 w-9 rounded-full bg-muted" />
              <div className="ml-4 space-y-2">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-3 w-16 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  }

  return (
    <>
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-6">
          {updates.map((software) => (
            <div 
              onClick={() => {
                setSelectedSoftware(software);
                setShowReleaseNotes(true);
              }}
              className="flex items-center cursor-pointer" 
              key={software.id}
            >
              <div className="ml-4 space-y-1">
                <p className="text-sm font-medium leading-none">{software.name}</p>
                <p className="text-sm text-muted-foreground">
                  Version {software.current_version}
                </p>
              </div>
              <div className="ml-auto text-sm text-muted-foreground">
                {software.release_date ? (
                  <span title="Release Date">Released {formatDate(software.release_date)}</span>
                ) : software.last_checked ? (
                  <span title="Last Checked">Updated {formatDate(software.last_checked)}</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {selectedSoftware && (
        <ReleaseNotesDialog
          open={showReleaseNotes}
          onOpenChange={setShowReleaseNotes}
          softwareName={selectedSoftware.name}
          softwareId={selectedSoftware.id}
        />
      )}
    </>
  );
}