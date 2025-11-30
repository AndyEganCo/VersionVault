import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useSoftwareList, useTrackedSoftware } from '@/lib/software/hooks';
import { toggleSoftwareTracking } from '@/lib/software/tracking';
import { SoftwareDetailModal } from '@/components/software/software-detail-modal';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatRelativeDate, formatDate } from '@/lib/date';
import { toast } from 'sonner';
import { Software } from '@/lib/software/types';
import { Trash2 } from 'lucide-react';

interface TrackedSoftwareProps {
  onUpdate?: () => void;
}

export function TrackedSoftware({ onUpdate }: TrackedSoftwareProps) {
  const { user } = useAuth();
  const { software, loading: softwareLoading, refreshSoftware } = useSoftwareList();
  const { trackedIds, loading: trackingLoading, refreshTracking } = useTrackedSoftware();
  const [selectedSoftware, setSelectedSoftware] = useState<Software | null>(null);

  const trackedSoftware = software.filter((s) => trackedIds.has(s.id));

  const handleUntrack = async (softwareId: string) => {
    if (!user) return;

    const success = await toggleSoftwareTracking(user.id, softwareId, false);
    if (success) {
      await Promise.all([refreshSoftware(), refreshTracking()]);
      onUpdate?.();
      toast.success('Software untracked');
    }
  };

  const loading = softwareLoading || trackingLoading;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (trackedSoftware.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              You haven't tracked any software yet
            </p>
            <Button asChild>
              <a href="/software">Browse Software</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Your Tracked Software</h2>
        <p className="text-muted-foreground">
          You're tracking {trackedSoftware.length} software {trackedSoftware.length === 1 ? 'item' : 'items'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {trackedSoftware.map((softwareItem: Software) => (
          <Card
            key={softwareItem.id}
            className="cursor-pointer hover:shadow-md transition-shadow group"
            onClick={() => setSelectedSoftware(softwareItem)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm leading-none truncate group-hover:underline">
                    {softwareItem.name}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">{softwareItem.manufacturer}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <Badge variant="secondary" className="w-fit">
                  {softwareItem.category}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUntrack(softwareItem.id);
                  }}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  title="Untrack"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>

              {softwareItem.current_version && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Version</span>
                  <Badge variant="outline">{softwareItem.current_version}</Badge>
                </div>
              )}

              {softwareItem.last_checked && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Last checked</span>
                  <span>{formatRelativeDate(softwareItem.last_checked)}</span>
                </div>
              )}

              {softwareItem.release_date && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Released</span>
                  <span>{formatDate(softwareItem.release_date)}</span>
                </div>
              )}

              <p className="text-xs text-muted-foreground pt-2">
                Click to view details
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedSoftware && (
        <SoftwareDetailModal
          open={!!selectedSoftware}
          onOpenChange={(open) => !open && setSelectedSoftware(null)}
          software={selectedSoftware}
          isTracked={trackedIds.has(selectedSoftware.id)}
          onTrackingChange={() => {
            refreshTracking();
            onUpdate?.();
          }}
        />
      )}
    </div>
  );
}
