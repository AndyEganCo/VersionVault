import { useAuth } from '@/contexts/auth-context';
import { useSoftwareList, useTrackedSoftware } from '@/lib/software/hooks';
import { toggleSoftwareTracking } from '@/lib/software/tracking';
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
        {trackedSoftware.map((software: Software) => (
          <Card key={software.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm leading-none truncate">{software.name}</h3>
                  <p className="text-xs text-muted-foreground truncate">{software.manufacturer}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUntrack(software.id)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  title="Untrack"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge variant="secondary" className="w-fit">
                {software.category}
              </Badge>

              {software.current_version && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Version</span>
                  <Badge variant="outline">{software.current_version}</Badge>
                </div>
              )}

              {software.last_checked && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Last checked</span>
                  <span>{formatRelativeDate(software.last_checked)}</span>
                </div>
              )}

              {software.release_date && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Released</span>
                  <span>{formatDate(software.release_date)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
