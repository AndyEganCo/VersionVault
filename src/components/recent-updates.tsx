import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UpdateList } from './recent-updates/update-list';
import { useRecentUpdates } from '@/lib/software/hooks/hooks';

interface RecentUpdatesProps {
  refreshTracking: () => Promise<void>;
  trackedIds: Set<string>;
}

export function RecentUpdates({ refreshTracking, trackedIds }: RecentUpdatesProps) {
  const { updates, loading } = useRecentUpdates();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Updates</CardTitle>
      </CardHeader>
      <CardContent>
        <UpdateList updates={updates} loading={loading} refreshTracking={refreshTracking} trackedIds={trackedIds} />
      </CardContent>
    </Card>
  );
}