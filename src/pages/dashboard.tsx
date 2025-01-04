import { RecentUpdates } from '@/components/recent-updates';
import { DashboardMetrics } from '@/components/dashboard/metrics';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';

export function Dashboard() {
  return (
    <PageLayout>
      <PageHeader 
        title="Dashboard"
        description="Monitor your software updates and activity"
      />
      <DashboardMetrics />
      <RecentUpdates />
    </PageLayout>
  );
}