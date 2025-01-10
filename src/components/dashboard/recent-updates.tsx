import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRecentUpdates } from '@/lib/software/hooks';
import { formatRelativeDate } from '@/lib/date';
import { ReleaseNotesDialog } from '@/components/software/release-notes/dialog';
import type { Software } from '@/lib/software/types';

export function RecentUpdates() {
  const { updates, loading } = useRecentUpdates();
  const [selectedSoftware, setSelectedSoftware] = useState<Software | null>(null);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Recent Updat111es</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {updates.map((software) => (
              <div
                key={software.id}
                className="flex items-center cursor-pointer hover:bg-muted/50 p-2 rounded-md"
                onClick={() => setSelectedSoftware(software)}
              >
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {software.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Version {software.current_version}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Updated {formatRelativeDate(software.last_checked || '')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedSoftware && (
        <ReleaseNotesDialog
          open={!!selectedSoftware}
          onOpenChange={(open) => !open && setSelectedSoftware(null)}
          softwareName={selectedSoftware.name}
          softwareId={selectedSoftware.id}
        />
      )}
    </>
  );
}