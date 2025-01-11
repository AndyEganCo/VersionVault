import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDate } from '@/lib/date';
import type { Software } from '@/lib/software/types';

export type UpdateListProps = {
  updates: Software[];
  loading: boolean;
};

function getFaviconUrl(website: string) {
  return `https://www.google.com/s2/favicons?domain=${website}&size=32`;
}

export function UpdateList({ updates, loading }: UpdateListProps) {
  if (loading) {
    return (
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center animate-pulse">
              <div className="h-9 w-9 rounded-full bg-muted" />
              <div className="ml-4 space-y-2">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-3 w-16 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-6">
        {updates.map((software) => (
          <div className="flex items-center" key={software.id}>
            <Avatar className="h-9 w-9">
              <AvatarImage 
                src={getFaviconUrl(software.website)} 
                alt={software.name} 
              />
              <AvatarFallback>
                {software.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="ml-4 space-y-1">
              <p className="text-sm font-medium leading-none">{software.name}</p>
              <p className="text-sm text-muted-foreground">
                Version {software.current_version}
              </p>
            </div>
            <div className="ml-auto text-sm text-muted-foreground">
              {software.release_date ? (
                <span title="Release Date">Released {formatDate(software.release_date)}</span>
              ) : software.last_checked ? (
                <span title="Last Checked">Updated {formatDate(software.last_checked)}</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}