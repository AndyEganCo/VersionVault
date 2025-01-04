import { useState } from 'react';
import { SoftwareCard } from '@/components/software/software-card';
import { SoftwareFilters } from '@/components/software/software-filters';
import { useAuth } from '@/contexts/auth-context';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { useSoftwareList, useTrackedSoftware } from '@/lib/software/hooks';
import { toggleSoftwareTracking } from '@/lib/software/tracking';
import { LoadingPage } from '@/components/loading';
import { toast } from 'sonner';

export function Software() {
  const { user } = useAuth();
  const { software, loading: softwareLoading, refreshSoftware } = useSoftwareList();
  const { trackedIds, loading: trackingLoading, refreshTracking } = useTrackedSoftware();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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
        <SoftwareFilters
          search={search}
          onSearchChange={setSearch}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredSoftware.map((s) => (
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