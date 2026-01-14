import { Software } from '@/lib/software/types';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/auth-context';
import { breakPhonePattern } from '@/lib/utils/version-display';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate } from '@/lib/date';
import { ExternalLink } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

interface SoftwareCardProps {
  software: Software;
  onTrackingChange: (id: string, tracked: boolean) => Promise<void>;
}

export function SoftwareCard({ software, onTrackingChange }: SoftwareCardProps) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleTrackingChange = async (_e: unknown | null, checked: boolean) => {
    await onTrackingChange(software.id, checked);
  };

  const handleCardClick = () => {
    // Update URL to open modal via deep linking
    setSearchParams({ software_id: software.id });
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow group h-full"
      onClick={handleCardClick}
    >
        <CardContent className="p-4 flex flex-col h-full">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm leading-tight truncate group-hover:underline">
                {software.name}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {software.manufacturer}
              </p>
            </div>
            {user && (
              <Switch
                checked={software.tracked}
                onCheckedChange={(checked) => handleTrackingChange(null, checked)}
                onClick={(e) => e.stopPropagation()}
                className="scale-75 origin-top-right shrink-0"
              />
            )}
          </div>

          <Badge variant="secondary" className="text-xs w-fit mb-3">
            {software.category}
          </Badge>

          <div className="space-y-1.5 mb-3 flex-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Version</span>
              <span className="font-medium">
                {software.current_version ? `v${breakPhonePattern(software.current_version)}` : 'N/A'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{software.release_date ? 'Released' : 'Added'}</span>
              <span>
                {formatDate(software.release_date || software.last_checked || software.created_at)}
              </span>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t">
            <a
              href={software.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Visit Website
            </a>
            {software.version_website && (
              <a
                href={software.version_website}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Release Notes
              </a>
            )}
          </div>
        </CardContent>
      </Card>
  );
}