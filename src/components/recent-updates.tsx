import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RecentUpdatesHeader } from './recent-updates/recent-updates-header';
import { UpdateList } from './recent-updates/update-list';
import { softwareList } from '@/data/software-list';
import { useAuth } from '@/contexts/auth-context';
import { getTrackedSoftware } from '@/lib/software';

export function RecentUpdates() {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [trackedSoftware, setTrackedSoftware] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTrackedSoftware() {
      if (user) {
        const tracked = await getTrackedSoftware(user.id);
        setTrackedSoftware(tracked);
      } else {
        setTrackedSoftware(new Set());
      }
      setLoading(false);
    }

    loadTrackedSoftware();
  }, [user]);

  const filteredUpdates = softwareList
    .filter(software => {
      const isTracked = user ? trackedSoftware.has(software.id) : true;
      const hasUpdate = software.lastChecked;
      const matchesCategory = !selectedCategory || software.category === selectedCategory;
      return isTracked && hasUpdate && matchesCategory;
    })
    .sort((a, b) => {
      const dateA = new Date(a.lastChecked!);
      const dateB = new Date(b.lastChecked!);
      return dateB.getTime() - dateA.getTime();
    });

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Recent Updates</CardTitle>
          <CardDescription>Loading updates...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center">
                <div className="h-9 w-9 rounded-full bg-muted" />
                <div className="ml-4 space-y-1 flex-1">
                  <div className="h-4 w-1/4 bg-muted rounded" />
                  <div className="h-3 w-1/3 bg-muted rounded" />
                </div>
                <div className="h-3 w-20 bg-muted rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recent Updates</CardTitle>
            <CardDescription>
              {user ? 'Latest updates for your tracked software' : 'Latest software version changes'}
            </CardDescription>
          </div>
          <RecentUpdatesHeader
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />
        </div>
      </CardHeader>
      <CardContent>
        <UpdateList updates={filteredUpdates} />
      </CardContent>
    </Card>
  );
}