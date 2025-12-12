import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useSoftwareList } from '@/lib/software/hooks/hooks';
import { toggleSoftwareTracking } from '@/lib/software/utils/tracking';
import { SoftwareDetailModal } from '@/components/software/software-detail-modal';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { formatDate } from '@/lib/date';
import { toast } from 'sonner';
import { Software } from '@/lib/software/types';
import { breakPhonePattern } from '@/lib/utils/version-display';

interface TrackedSoftwareProps {
  refreshTracking: () => Promise<void>;
  trackedIds: Set<string>;
}

export function TrackedSoftware({ refreshTracking, trackedIds }: TrackedSoftwareProps) {
  const { user } = useAuth();
  const { software, loading: softwareLoading, refreshSoftware } = useSoftwareList();
  const [selectedSoftware, setSelectedSoftware] = useState<Software | null>(null);

  const trackedSoftware = software.filter((s) => trackedIds.has(s.id));
  const loading = softwareLoading;

  // Close modal if the selected software is no longer tracked
  useEffect(() => {
    if (selectedSoftware && !trackedIds.has(selectedSoftware.id)) {
      setSelectedSoftware(null);
    }
  }, [trackedIds, selectedSoftware]);

  const handleUntrack = async (softwareId: string) => {
    if (!user) return;

    const success = await toggleSoftwareTracking(user.id, softwareId, false);
    if (success) {
      await refreshTracking();
      toast.success('Software untracked');
    }
  };

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

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {trackedSoftware.map((softwareItem: Software) => (
          <Card
            key={softwareItem.id}
            className="cursor-pointer hover:shadow-md transition-shadow group"
            onClick={() => setSelectedSoftware(softwareItem)}
          >
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-sm leading-tight truncate group-hover:underline flex-1">
                  {softwareItem.name}
                </h3>
                <Switch
                  checked={true}
                  onCheckedChange={(checked) => {
                    handleUntrack(softwareItem.id);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="scale-75 origin-top-right"
                />
              </div>

              {softwareItem.current_version && (
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="text-muted-foreground">v{breakPhonePattern(softwareItem.current_version)}</span>
                </div>
              )}

              {(softwareItem.release_date || softwareItem.last_checked) && (
                <div className="text-xs text-muted-foreground">
                  {formatDate(softwareItem.release_date || softwareItem.last_checked)}
                </div>
              )}
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
          }}
        />
      )}
    </div>
  );
}
