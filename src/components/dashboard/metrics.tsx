import { useAuth } from '@/contexts/auth-context';
import { getTrackedSoftware } from '@/lib/software';
import { getSoftwareList } from '@/lib/software/api';
import { useEffect, useState } from 'react';
import { MetricCard } from './metric-card';
import { isMajorUpdate, getThisWeeksUpdates } from '@/lib/version';
import type { Software } from '@/lib/software/types';

export function DashboardMetrics() {
  const { user } = useAuth();
  const [trackedCount, setTrackedCount] = useState(0);
  const [software, setSoftware] = useState<Software[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // Get software from database
        const softwareData = await getSoftwareList();
        setSoftware(softwareData);

        // Get tracked software
        if (user) {
          const tracked = await getTrackedSoftware(user.id);
          setTrackedCount(tracked.size);
        } else {
          setTrackedCount(softwareData.length);
        }
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user]);

  const thisWeeksUpdates = getThisWeeksUpdates(software);
  const majorUpdates = software.filter(s => s.current_version && isMajorUpdate(s)).length;

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