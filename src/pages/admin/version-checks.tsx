import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { VersionCheckList } from '@/components/admin/version-check-list';
import { VersionCheckStats } from '@/components/admin/version-check-stats';
import { VersionCheckFilters } from '@/components/admin/version-check-filters';
import { useVersionChecks } from '@/hooks/use-version-checks';
import { useAuth } from '@/contexts/auth-context';
import { Navigate } from 'react-router-dom';

type Filters = {
  status: 'all' | 'error' | 'success';
  timeRange: '24h' | '7d' | '30d' | 'all';
};

export function AdminVersionChecks() {
  const { user, isAdmin } = useAuth();
  const [filters, setFilters] = useState<Filters>({
    status: 'all',
    timeRange: '24h'
  });

  const { checks, stats, loading } = useVersionChecks(filters);

  // Redirect non-admin users
  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleFilterChange = (newFilters: Filters) => {
    setFilters(newFilters);
  };

  return (
    <PageLayout>
      <PageHeader
        title="Version Check Admin"
        description="Monitor and analyze version check results"
      />
      
      <div className="space-y-6">
        <VersionCheckStats stats={stats} />
        <VersionCheckFilters
          filters={filters}
          onFilterChange={handleFilterChange}
        />
        <VersionCheckList 
          checks={checks}
          loading={loading}
        />
      </div>
    </PageLayout>
  );
}