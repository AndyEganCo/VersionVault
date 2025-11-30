import { RecentUpdates } from '@/components/recent-updates';
import { Metrics } from '@/components/dashboard/metrics';
import { TrackedSoftware } from '@/components/dashboard/tracked-software';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { useRecentUpdates, useTrackedSoftware } from '@/lib/software/hooks';

export function Dashboard() {
  const { updates } = useRecentUpdates();
  const { trackedIds, refreshTracking } = useTrackedSoftware();

  const trackedCount = trackedIds.size;

  const thisWeeksUpdates = updates.filter(s => {
    if (!s.release_date) return false;
    const date = new Date(s.release_date);
    const now = new Date();
    return (now.getTime() - date.getTime()) <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  return (
    <PageLayout>
      <PageHeader
        title="Dashboard"
        description="Monitor your software updates and activity"
      />
      <Metrics
        trackedCount={trackedCount}
        thisWeeksUpdates={thisWeeksUpdates}
        majorUpdates={updates.filter(s => s.release_notes?.[0]?.type === 'major').length}
      />
      <div className="space-y-12">
        <TrackedSoftware refreshTracking={refreshTracking} trackedIds={trackedIds} />
        <RecentUpdates refreshTracking={refreshTracking} trackedIds={trackedIds} />
      </div>
    </PageLayout>
  );
}