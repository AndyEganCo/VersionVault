import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Navigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { SoftwareTable } from '@/components/admin/software/software-table';
import { SoftwareFilters } from '@/components/admin/software/software-filters';
import { AddSoftwareDialog } from '@/components/admin/software/add-software-dialog';
import { useSoftwareList } from '@/lib/software/hooks';

export function AdminSoftware() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { software, loading, refreshSoftware } = useSoftwareList();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const handleSoftwareUpdate = useCallback(async () => {
    await refreshSoftware();
  }, [refreshSoftware]);

  // Wait for auth to load before checking admin status
  if (authLoading) {
    return null;
  }

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

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
      />
      
      <AddSoftwareDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={handleSoftwareUpdate}
      />
    </PageLayout>
  );
}