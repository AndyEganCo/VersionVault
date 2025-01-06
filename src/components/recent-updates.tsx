import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UpdateList } from './recent-updates/update-list';
import { useRecentUpdates } from '@/lib/software/hooks';

export function RecentUpdates() {
  const { updates, loading } = useRecentUpdates();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Updates</CardTitle>
      </CardHeader>
      <CardContent>
        <UpdateList updates={updates} loading={loading} />
      </CardContent>
    </Card>
  );
}