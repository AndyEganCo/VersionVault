import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RecentUpdatesHeader } from './recent-updates-header';
import { RecentUpdatesList } from './recent-updates-list';
import { useSoftwareList } from '@/lib/software/hooks';

export function RecentUpdates() {
  const { software, loading } = useSoftwareList();
  const [activeCategory, setActiveCategory] = useState<string | null>('all');

  const filteredSoftware = software.filter(s => 
    activeCategory === 'all' || s.category === activeCategory
  );

  const handleCategoryChange = (category: string | null) => {
    setActiveCategory(category || 'all');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recent Updates</CardTitle>
          <RecentUpdatesHeader 
            onCategoryChange={handleCategoryChange}
          />
        </div>
      </CardHeader>
      <CardContent>
        <RecentUpdatesList 
          software={filteredSoftware}
          loading={loading}
        />
      </CardContent>
    </Card>
  );
} 