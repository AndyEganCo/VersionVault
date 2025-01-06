import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/auth-context';
import { MouseEvent } from 'react';

type SoftwareCardActionsProps = {
  website: string;
  tracked: boolean;
  onTrackingChange: (tracked: boolean) => void;
};

export function SoftwareCardActions({ website, tracked, onTrackingChange }: SoftwareCardActionsProps) {
  const { user } = useAuth();

  return (
    <div className="space-y-2" onClick={e => e.stopPropagation()}>
      <Button 
        variant="outline" 
        className="w-full" 
        asChild
      >
        <a 
          href={website} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-primary hover:text-primary"
          onClick={e => e.stopPropagation()}
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
            checked={tracked} 
            onCheckedChange={onTrackingChange}
          />
        </div>
      )}
    </div>
  );
}