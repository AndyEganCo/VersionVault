import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatRelativeDate } from '@/lib/date';
import { Software } from '@/data/software-list';

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
                Version {software.currentVersion}
              </p>
            </div>
            <div className="ml-auto text-sm text-muted-foreground">
              {formatRelativeDate(software.lastChecked!)}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}