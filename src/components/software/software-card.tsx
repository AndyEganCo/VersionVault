import { useState } from 'react';
import { Software } from '@/lib/software/types';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/auth-context';
import { SoftwareDetailModal } from './software-detail-modal';
import { breakPhonePattern } from '@/lib/utils/version-display';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate } from '@/lib/date';

interface SoftwareCardProps {
  software: Software;
  onTrackingChange: (id: string, tracked: boolean) => Promise<void>;
}

export function SoftwareCard({ software, onTrackingChange }: SoftwareCardProps) {
  const { user } = useAuth();
  const [showDetails, setShowDetails] = useState(false);

  const handleTrackingChange = async (_e: unknown | null, checked: boolean) => {
    await onTrackingChange(software.id, checked);
  };

  return (
    <>
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow group"
        onClick={() => setShowDetails(true)}
      >
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm leading-tight truncate group-hover:underline flex-1">
              {software.name}
            </h3>
            {user && (
              <Switch
                checked={software.tracked}
                onCheckedChange={(checked) => handleTrackingChange(null, checked)}
                onClick={(e) => e.stopPropagation()}
                className="scale-75 origin-top-right"
              />
            )}
          </div>

          {software.current_version && (
            <div className="flex items-center justify-between text-xs gap-2">
              <span className="text-muted-foreground">v{breakPhonePattern(software.current_version)}</span>
            </div>
          )}

          {software.release_date && (
            <div className="text-xs text-muted-foreground">
              {formatDate(software.release_date)}
            </div>
          )}
        </CardContent>
      </Card>

      <SoftwareDetailModal
        open={showDetails}
        onOpenChange={setShowDetails}
        software={software}
        isTracked={software.tracked}
        onTrackingChange={(tracked) => onTrackingChange(software.id, tracked)}
      />
    </>
  );
}