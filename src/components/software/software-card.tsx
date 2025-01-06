import { useState } from 'react';
import { Software } from '@/lib/software/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/auth-context';
import { ReleaseNotesDialog } from './release-notes/dialog';
import { useReleaseNotes } from '@/hooks/use-release-notes';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';

type SoftwareCardProps = {
  software: Software;
  onTrackingChange: (id: string, tracked: boolean) => void;
};

export function SoftwareCard({ software, onTrackingChange }: SoftwareCardProps) {
  const { user } = useAuth();
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const { releaseNotes } = useReleaseNotes(software.id);

  const handleTrackingChange = (_e: unknown | null, checked: boolean) => {
    onTrackingChange(software.id, checked);
  };

  return (
    <>
      <Card>
        <div 
          className="cursor-pointer" 
          onClick={() => setShowReleaseNotes(true)}
        >
          <CardHeader className="pb-3">
            <div className="space-y-1">
              <h3 className="font-semibold leading-none">{software.name}</h3>
              <p className="text-sm text-muted-foreground">{software.manufacturer}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge variant="secondary" className="bg-secondary">
              {software.category}
            </Badge>
            
            {software.current_version && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Version</span>
                <Badge variant="outline">{software.current_version}</Badge>
              </div>
            )}
            
            {software.last_checked && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Last checked</span>
                <span className="text-sm">{software.last_checked}</span>
              </div>
            )}
          </CardContent>
        </div>

        <CardContent className="pt-0">
          <div className="space-y-2" onClick={e => e.stopPropagation()}>
            <Button 
              variant="outline" 
              className="w-full" 
              asChild
            >
              <a 
                href={software.website} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:text-primary"
              >
                Visit Website
              </a>
            </Button>
            
            {user && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-muted-foreground">
                  Track Updates
                </span>
                <Switch 
                  checked={software.tracked} 
                  onCheckedChange={(checked) => handleTrackingChange(null, checked)}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <ReleaseNotesDialog
        open={showReleaseNotes}
        onOpenChange={setShowReleaseNotes}
        softwareName={software.name}
        releaseNotes={releaseNotes}
      />
    </>
  );
}