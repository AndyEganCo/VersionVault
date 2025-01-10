import { Software } from '@/lib/software/types';
import { SoftwareCard } from '../software/software-card';

type RecentUpdatesListProps = {
  software: Software[];
  loading: boolean;
  onTrackingChange?: (id: string, tracked: boolean) => Promise<void>;
};

export function RecentUpdatesList({ 
  software, 
  loading,
  onTrackingChange 
}: RecentUpdatesListProps) {
  if (loading) {
    return <div>Loading...</div>;
  }

  if (!software.length) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        No recent updates found
      </div>
    );
  }

  const handleTrackingChange = async (id: string, tracked: boolean) => {
    if (onTrackingChange) {
      await onTrackingChange(id, tracked);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {software.map((item) => (
        <SoftwareCard
          key={item.id}
          software={item}
          onTrackingChange={handleTrackingChange}
        />
      ))}
    </div>
  );
} 