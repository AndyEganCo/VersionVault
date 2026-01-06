import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { SoftwareCard } from '@/components/software/software-card';
import { SoftwareFilters } from '@/components/software/software-filters';
import { useAuth } from '@/contexts/auth-context';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { useSoftwareList, useTrackedSoftware } from '@/lib/software/hooks/hooks';
import { toggleSoftwareTracking } from '@/lib/software/utils/tracking';
import { LoadingPage } from '@/components/loading';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { SortOption } from '@/types/software';
import { RequestSoftwareModal } from '@/components/software/request-software-modal';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { SoftwareDetailModal } from '@/components/software/software-detail-modal';
import { AdBanner } from '@/components/dashboard/ad-banner';
import type { Software as SoftwareType } from '@/lib/software/types';

export function Software() {
  const { user } = useAuth();
  const { software, loading: softwareLoading, refreshSoftware } = useSoftwareList();
  const { trackedIds, loading: trackingLoading, refreshTracking } = useTrackedSoftware();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [urlSoftware, setUrlSoftware] = useState<SoftwareType | null>(null);
  const [isLoadingSoftware, setIsLoadingSoftware] = useState(false);
  const [hasProcessedAction, setHasProcessedAction] = useState(false);

  const loading = softwareLoading || trackingLoading;

  const filteredSoftware = software
    .filter((s) => {
      const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.manufacturer.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !selectedCategory || s.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .map(s => ({
      ...s,
      tracked: trackedIds.has(s.id)
    }));

  const sortedSoftware = filteredSoftware.sort((a, b) => {
    switch (sortBy) {
      case 'releaseDate':
        const aDate = a.release_date || a.last_checked;
        const bDate = b.release_date || b.last_checked;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      case 'lastChecked':
        if (!a.last_checked) return 1;
        if (!b.last_checked) return -1;
        return new Date(b.last_checked).getTime() - new Date(a.last_checked).getTime();
      case 'category':
        return a.category.localeCompare(b.category);
      case 'version':
        return (b.current_version || '').localeCompare(a.current_version || '');
      default:
        return a.name.localeCompare(b.name);
    }
  });

  const handleTrackingChange = async (id: string, tracked: boolean) => {
    if (!user) {
      toast.error('Please sign in to track software');
      return;
    }

    const success = await toggleSoftwareTracking(user.id, id, tracked);
    if (success) {
      await Promise.all([
        refreshSoftware(),
        refreshTracking()
      ]);
      toast.success(tracked ? 'Software tracked' : 'Software untracked');
    }
  };

  const handleTrackAll = async () => {
    if (!user) {
      toast.error('Please sign in to track software');
      return;
    }

    setBulkLoading(true);
    try {
      const untracked = sortedSoftware.filter(s => !s.tracked);

      if (untracked.length === 0) {
        toast.info('All displayed software is already tracked');
        return;
      }

      for (const item of untracked) {
        await toggleSoftwareTracking(user.id, item.id, true);
      }

      await Promise.all([
        refreshSoftware(),
        refreshTracking()
      ]);

      toast.success(`Tracked ${untracked.length} software`);
    } catch (error) {
      toast.error('Failed to track software');
      console.error(error);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleUntrackAll = async () => {
    if (!user) {
      toast.error('Please sign in to manage software');
      return;
    }

    setBulkLoading(true);
    try {
      const tracked = sortedSoftware.filter(s => s.tracked);

      if (tracked.length === 0) {
        toast.info('No tracked software to untrack');
        return;
      }

      for (const item of tracked) {
        await toggleSoftwareTracking(user.id, item.id, false);
      }

      await Promise.all([
        refreshSoftware(),
        refreshTracking()
      ]);

      toast.success(`Untracked ${tracked.length} software`);
    } catch (error) {
      toast.error('Failed to untrack software');
      console.error(error);
    } finally {
      setBulkLoading(false);
    }
  };

  // Handle deep linking from email - fetch software when software_id parameter is present
  useEffect(() => {
    const softwareId = searchParams.get('software_id');
    const action = searchParams.get('action');

    if (softwareId && !isLoadingSoftware) {
      setIsLoadingSoftware(true);

      // Fetch software details
      supabase
        .from('software')
        .select('*')
        .eq('id', softwareId)
        .single()
        .then(async ({ data, error }) => {
          if (error) {
            console.error('Error fetching software:', error);
            toast.error('Software not found');
            // Clear the invalid parameter
            searchParams.delete('software_id');
            searchParams.delete('action');
            setSearchParams(searchParams);
          } else if (data) {
            setUrlSoftware(data as SoftwareType);

            // Handle auto-tracking action
            if (action === 'track' && user && !hasProcessedAction) {
              setHasProcessedAction(true);
              const isTracked = trackedIds.has(data.id);

              if (!isTracked) {
                const success = await toggleSoftwareTracking(user.id, data.id, true);
                if (success) {
                  await refreshTracking();
                  toast.success('Now tracking ' + data.name);
                }
              }
            }
          }
        })
        .finally(() => {
          setIsLoadingSoftware(false);
        });
    } else if (!softwareId && urlSoftware) {
      // Clear software when parameter is removed
      setUrlSoftware(null);
      setHasProcessedAction(false);
    }
  }, [searchParams, isLoadingSoftware, urlSoftware, setSearchParams, user, trackedIds, hasProcessedAction, refreshTracking]);

  // Handle modal close - remove software_id and action from URL
  const handleModalClose = () => {
    setUrlSoftware(null);
    setHasProcessedAction(false);
    searchParams.delete('software_id');
    searchParams.delete('action');
    setSearchParams(searchParams);
  };

  return (
    <PageLayout>
      <Helmet>
        <title>Software Catalog - Track 400+ Applications | VersionVault</title>
        <meta name="description" content="Browse 400+ software apps including dev tools, creative software, and business apps. Track updates and get instant email notifications." />
        <link rel="canonical" href="https://versionvault.dev/software" />

        {/* Open Graph */}
        <meta property="og:title" content="Software Catalog - Track 400+ Applications | VersionVault" />
        <meta property="og:description" content="Browse and track 400+ software applications. Get instant notifications when new versions are released." />
        <meta property="og:url" content="https://versionvault.dev/software" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://versionvault.dev/favicon.svg" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Software Catalog - Track 400+ Applications" />
        <meta name="twitter:description" content="Browse and track 400+ software applications with VersionVault." />
        <meta name="twitter:image" content="https://versionvault.dev/favicon.svg" />

        {/* Structured Data - ItemList for Software Catalog */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": "Software Applications Tracked by VersionVault",
            "description": "Comprehensive catalog of software applications with version tracking",
            "numberOfItems": software.length,
            "itemListElement": sortedSoftware.slice(0, 10).map((item, index) => ({
              "@type": "ListItem",
              "position": index + 1,
              "item": {
                "@type": "SoftwareApplication",
                "name": item.name,
                "applicationCategory": item.category,
                "softwareVersion": item.current_version || "Unknown",
                "author": {
                  "@type": "Organization",
                  "name": item.manufacturer
                },
                "url": item.website
              }
            }))
          })}
        </script>
      </Helmet>

      <PageHeader
        title="Software"
        description="Browse and track software updates"
      />
      <div className="space-y-6">
        {/* Ad Banner */}
        <AdBanner />

        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <h1 className="text-2xl font-bold">Software Updates</h1>
          <div className="flex items-center gap-2">
            {user && sortedSoftware.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTrackAll}
                  disabled={bulkLoading || sortedSoftware.every(s => s.tracked)}
                >
                  Track All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUntrackAll}
                  disabled={bulkLoading || sortedSoftware.every(s => !s.tracked)}
                >
                  Untrack All
                </Button>
              </>
            )}
            <RequestSoftwareModal />
          </div>
        </div>
        <SoftwareFilters
          search={search}
          onSearchChange={setSearch}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          sortBy={sortBy}
          onSortChange={(value: SortOption) => setSortBy(value)}
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
          {sortedSoftware.map((s) => (
            <SoftwareCard
              key={s.id}
              software={s}
              onTrackingChange={handleTrackingChange}
            />
          ))}
        </div>
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