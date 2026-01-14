import { useState, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { SoftwareTable } from '@/components/admin/software/software-table';
import { SoftwareFilters } from '@/components/admin/software/software-filters';
import { AddSoftwareDialog } from '@/components/admin/software/add-software-dialog';
import { VersionReviewWidget } from '@/components/admin/version-review-widget';
import { useSoftwareList } from '@/lib/software/hooks/hooks';
import { useSoftwareTrackingCounts } from '@/lib/software/hooks/tracking-hooks';
import { TrackingUsersModal } from '@/components/software/tracking-users-modal';
import type { Software } from '@/lib/software/types';

export function AdminSoftware() {
  const { software, loading, refreshSoftware } = useSoftwareList();
  const { counts: trackingCounts } = useSoftwareTrackingCounts();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [trackingModalSoftware, setTrackingModalSoftware] = useState<Software | null>(null);

  const handleSoftwareUpdate = useCallback(async () => {
    await refreshSoftware();
  }, [refreshSoftware]);

  // Filter and sort software
  const filteredSoftware = software
    .filter((s) => {
      const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.manufacturer.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !selectedCategory || s.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <PageLayout>
      <PageHeader
        title="Software Management"
        description="Add and manage software entries"
      />

      <VersionReviewWidget />

      <div className="flex justify-end gap-2 mb-6">
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Software
        </Button>
      </div>

      <SoftwareFilters
        search={search}
        onSearchChange={setSearch}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
      />

      <SoftwareTable
        data={filteredSoftware}
        loading={loading}
        onUpdate={handleSoftwareUpdate}
        trackingCounts={trackingCounts}
        onViewTracking={(software) => setTrackingModalSoftware(software)}
      />

      <AddSoftwareDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={handleSoftwareUpdate}
      />

      <TrackingUsersModal
        softwareId={trackingModalSoftware?.id || null}
        softwareName={trackingModalSoftware?.name || ''}
        onClose={() => setTrackingModalSoftware(null)}
      />
    </PageLayout>
  );
}