import { useState } from 'react';
import { SoftwareCard } from '@/components/software/software-card';
import { SoftwareFilters } from '@/components/software/software-filters';
import { useAuth } from '@/contexts/auth-context';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { useSoftwareList, useTrackedSoftware } from '@/lib/software/hooks';
import { toggleSoftwareTracking } from '@/lib/software/tracking';
import { LoadingPage } from '@/components/loading';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { SortOption } from '@/types/software';
import { RequestSoftwareModal } from '@/components/software/request-software-modal';

export function Software() {
  const { user } = useAuth();
  const { software, loading: softwareLoading, refreshSoftware } = useSoftwareList();
  const { trackedIds, loading: trackingLoading, refreshTracking } = useTrackedSoftware();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [bulkLoading, setBulkLoading] = useState(false);

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
        if (!a.release_date) return 1;
        if (!b.release_date) return -1;
        return new Date(b.release_date).getTime() - new Date(a.release_date).getTime();
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

  if (loading) {
    return <LoadingPage />;
  }

  return (
    <PageLayout>
      <PageHeader 
        title="Software"
        description="Browse and track software updates"
      />
      <div className="space-y-6">
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedSoftware.map((s) => (
            <SoftwareCard
              key={s.id}
              software={s}
              onTrackingChange={handleTrackingChange}
            />
          ))}
        </div>
      </div>
    </PageLayout>
  );
}