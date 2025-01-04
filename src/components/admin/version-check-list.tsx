import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { formatRelativeDate } from '@/lib/date';
import type { VersionCheck } from '@/types/version-check';

type VersionCheckListProps = {
  checks: VersionCheck[];
  loading: boolean;
};

export function VersionCheckList({ checks, loading }: VersionCheckListProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Checks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-1/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/3" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Checks</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-6">
            {checks.map((check) => (
              <div 
                key={check.id}
                className="flex items-start justify-between border-b pb-4 last:border-0"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      {check.software_name || 'Unknown Software'}
                    </p>
                    <Badge variant={check.status === 'success' ? 'default' : 'destructive'}>
                      {check.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {check.url}
                  </p>
                  {check.error && (
                    <p className="text-sm text-destructive">
                      {check.error}
                    </p>
                  )}
                </div>
                <div className="text-right space-y-1">
                  {check.detected_version && (
                    <p className="text-sm font-medium">
                      v{check.detected_version}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {formatRelativeDate(check.checked_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}