import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDate } from '@/lib/date';
import type { Software } from '@/lib/software/types';

type UpdateListProps = {
  updates: Software[];
};

export function UpdateList({ updates }: UpdateListProps) {
  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-6">
        {updates.map((software) => (
          <div className="flex items-center" key={software.id}>
            <Avatar className="h-9 w-9">
              <AvatarImage 
                src={`${new URL(software.website).origin}/favicon.ico`} 
                alt={software.name} 
              />
              <AvatarFallback>
                {software.name.split(' ').map(word => word[0]).join('')}
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