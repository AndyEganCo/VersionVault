import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ScrapeStatus } from '@/types/scrape';

type CheckResultsProps = {
  status: ScrapeStatus | null;
};

export function CheckResults({ status }: CheckResultsProps) {
  if (!status) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No results yet. Start a version check to see details.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Results</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Status</span>
            <Badge variant={status.success ? 'default' : 'destructive'}>
              {status.success ? 'Success' : 'Failed'}
            </Badge>
          </div>
          {status.softwareName && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Software</span>
              <span>{status.softwareName}</span>
            </div>
          )}
          {status.currentVersion && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Current Version</span>
              <span className="font-mono">{status.currentVersion}</span>
            </div>
          )}
          {status.version && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Detected Version</span>
              <Badge variant={status.version !== status.currentVersion ? 'default' : 'secondary'}>
                {status.version}
              </Badge>
            </div>
          )}
          {status.error && (
            <div className="text-sm text-destructive">
              Error: {status.error}
            </div>
          )}
        </div>
        {status.content && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Details</h4>
            <ScrollArea className="h-[200px] w-full rounded-md border p-4">
              <pre className="text-xs whitespace-pre-wrap">{status.content}</pre>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}