import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDate } from '@/lib/date';
import type { Software } from '@/lib/software/types';
import { useSearchParams } from 'react-router-dom';

export type UpdateListProps = {
  updates: Software[];
  loading: boolean;
  refreshTracking: () => Promise<void>;
  trackedIds: Set<string>;
};

export function UpdateList({ updates, loading, refreshTracking, trackedIds }: UpdateListProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter to only show tracked software
  const trackedUpdates = updates.filter(u => trackedIds.has(u.id));

  const handleSoftwareClick = (softwareId: string) => {
    // Update URL to open modal via deep linking
    setSearchParams({ software_id: softwareId });
  };

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
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-6">
        {trackedUpdates.map((software) => (
          <div
            onClick={() => handleSoftwareClick(software.id)}
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
                {(software.release_date || software.last_checked) && (
                  <span title={software.release_date ? "Release Date" : "Last Checked"}>
                    {software.release_date ? "Released" : "Updated"} {formatDate(software.release_date || software.last_checked)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
  );
}