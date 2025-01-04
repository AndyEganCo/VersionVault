import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { ManualCheckForm } from '@/components/manual-check/manual-check-form';
import { CheckResults } from '@/components/manual-check/check-results';
import { ScrapeStatus } from '@/types/scrape';

export function ManualCheck() {
  const [status, setStatus] = useState<ScrapeStatus | null>(null);

  return (
    <PageLayout>
      <PageHeader
        title="Manual Version Check"
        description="Manually check software versions and view scraping results"
      />
      <div className="grid gap-6 md:grid-cols-2">
        <ManualCheckForm onStatusChange={setStatus} />
        <CheckResults status={status} />
      </div>
    </PageLayout>
  );
}