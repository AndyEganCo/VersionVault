import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { softwareList } from '@/data/software-list';
import { getTrackedSoftware } from '@/lib/software';
import { useEffect, useState } from 'react';
import { MetricCard } from './metric-card';
import { isMajorUpdate, getThisWeeksUpdates } from '@/lib/version';

export function DashboardMetrics() {
  const { user } = useAuth();
  const [trackedCount, setTrackedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTrackedSoftware() {
      if (user) {
        const tracked = await getTrackedSoftware(user.id);
        setTrackedCount(tracked.size);
      } else {
        setTrackedCount(softwareList.length);
      }
      setLoading(false);
    }

    loadTrackedSoftware();
  }, [user]);

  const thisWeeksUpdates = getThisWeeksUpdates(softwareList);
  const majorUpdates = softwareList.filter(s => s.currentVersion && isMajorUpdate(s)).length;

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-3 w-full">
      <MetricCard
        title="Tracked Software"
        value={trackedCount}
        description={user ? "+2 from last month" : "Total available"}
      />
      <MetricCard
        title="This Week's Updates"
        value={thisWeeksUpdates}
        description="Software updates this week"
      />
      <MetricCard
        title="Major Updates"
        value={majorUpdates}
        description="Version jumps (e.g. 8.x → 9.x)"
      />
    </div>
  );
}