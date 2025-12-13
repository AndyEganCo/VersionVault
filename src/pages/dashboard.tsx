import { RecentUpdates } from '@/components/recent-updates';
import { Metrics } from '@/components/dashboard/metrics';
import { TrackedSoftware } from '@/components/dashboard/tracked-software';
import { AdBanner } from '@/components/dashboard/ad-banner';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { BetaBanner } from '@/components/beta-banner';
import { OnboardingModal } from '@/components/onboarding-modal';
import { useRecentUpdates, useTrackedSoftware } from '@/lib/software/hooks';
import { useAuth } from '@/contexts/auth-context';
import { useRecentUpdates, useTrackedSoftware } from '@/lib/software/hooks/hooks';

export function Dashboard() {
  const { isPremium } = useAuth();
  const { updates } = useRecentUpdates();
  const { trackedIds, refreshTracking } = useTrackedSoftware();

  const trackedCount = trackedIds.size;

  const thisWeeksUpdates = updates.filter(s => {
    const dateStr = s.release_date || s.last_checked;
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const now = new Date();
    return (now.getTime() - date.getTime()) <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  return (
    <PageLayout>
      <PageHeader
        title="Dashboard"
        description="Monitor your software updates and activity"
      />
      <OnboardingModal />
      <BetaBanner />
      <Metrics
        trackedCount={trackedCount}
        thisWeeksUpdates={thisWeeksUpdates}
      />
      <div className="space-y-12">
        <RecentUpdates refreshTracking={refreshTracking} trackedIds={trackedIds} />
        {/* Ad placement - hidden for premium subscribers */}
        <AdBanner show={!isPremium} />
        <TrackedSoftware refreshTracking={refreshTracking} trackedIds={trackedIds} />
      </div>
    </PageLayout>
  );
}
