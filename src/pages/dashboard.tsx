import { RecentUpdates } from '@/components/recent-updates';
import { Metrics } from '@/components/dashboard/metrics';
import { TrackedSoftware } from '@/components/dashboard/tracked-software';
import { AdBanner } from '@/components/dashboard/ad-banner';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { BetaBanner } from '@/components/beta-banner';
import { OnboardingModal } from '@/components/onboarding-modal';
import { useRecentUpdates, useTrackedSoftware } from '@/lib/software/hooks/hooks';
import { useAuth } from '@/contexts/auth-context';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { SoftwareDetailModal } from '@/components/software/software-detail-modal';
import type { Software } from '@/lib/software/types';

export function Dashboard() {
  const { isPremium } = useAuth();
  const { updates } = useRecentUpdates();
  const { trackedIds, refreshTracking } = useTrackedSoftware();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [urlSoftware, setUrlSoftware] = useState<Software | null>(null);
  const [isLoadingSoftware, setIsLoadingSoftware] = useState(false);

  const trackedCount = trackedIds.size;

  const thisWeeksUpdates = updates.filter(s => {
    const dateStr = s.release_date || s.last_checked;
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const now = new Date();
    return (now.getTime() - date.getTime()) <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  // Handle deep linking from email - fetch software when software_id parameter is present
  useEffect(() => {
    const softwareId = searchParams.get('software_id');
    if (softwareId && !isLoadingSoftware) {
      setIsLoadingSoftware(true);

      // Fetch software details
      supabase
        .from('software')
        .select('*')
        .eq('id', softwareId)
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.error('Error fetching software:', error);
            // Clear the invalid parameter
            searchParams.delete('software_id');
            setSearchParams(searchParams);
          } else if (data) {
            setUrlSoftware(data as Software);
          }
        })
        .finally(() => {
          setIsLoadingSoftware(false);
        });
    } else if (!softwareId && urlSoftware) {
      // Clear software when parameter is removed
      setUrlSoftware(null);
    }
  }, [searchParams, isLoadingSoftware, urlSoftware, setSearchParams]);

  // Handle modal close - remove software_id from URL
  const handleModalClose = () => {
    setUrlSoftware(null);
    searchParams.delete('software_id');
    setSearchParams(searchParams);
  };

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

      {/* Deep-linked software modal from email */}
      {urlSoftware && (
        <SoftwareDetailModal
          open={!!urlSoftware}
          onOpenChange={(open) => !open && handleModalClose()}
          software={urlSoftware}
          isTracked={trackedIds.has(urlSoftware.id)}
          onTrackingChange={() => {
            refreshTracking();
          }}
        />
      )}
    </PageLayout>
  );
}
