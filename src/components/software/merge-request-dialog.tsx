import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface SoftwareOption {
  id: string;
  name: string;
  manufacturer: string;
  category: string;
}

interface MergeRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (softwareId: string, softwareName: string) => void;
  requestName: string;
  isLoading?: boolean;
}

export function MergeRequestDialog({
  open,
  onOpenChange,
  onConfirm,
  requestName,
  isLoading = false,
}: MergeRequestDialogProps) {
  const [softwareList, setSoftwareList] = useState<SoftwareOption[]>([]);
  const [loadingSoftware, setLoadingSoftware] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedId(null);
      fetchSoftware();
    }
  }, [open]);

  const fetchSoftware = async () => {
    setLoadingSoftware(true);
    try {
      const { data, error } = await supabase
        .from('software')
        .select('id, name, manufacturer, category')
        .order('name');

      if (error) throw error;
      setSoftwareList(data || []);
    } catch (error) {
      console.error('Error fetching software list:', error);
    } finally {
      setLoadingSoftware(false);
    }
  };

  const selectedSoftware = softwareList.find(s => s.id === selectedId);

  const handleConfirm = () => {
    if (selectedId && selectedSoftware) {
      onConfirm(selectedId, selectedSoftware.name);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Merge with Existing Software</DialogTitle>
          <DialogDescription>
            Approve "{requestName}" by linking it to software already being tracked.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {loadingSoftware ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Command className="border rounded-md">
              <CommandInput placeholder="Search software..." />
              <CommandList className="max-h-[250px]">
                <CommandEmpty>No software found.</CommandEmpty>
                <CommandGroup>
                  {softwareList.map((software) => (
                    <CommandItem
                      key={software.id}
                      value={`${software.name} ${software.manufacturer}`}
                      onSelect={() => setSelectedId(software.id)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4 flex-shrink-0',
                          selectedId === software.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium truncate">{software.name}</span>
                        <span className="text-xs text-muted-foreground truncate">
                          {software.manufacturer} &middot; {software.category}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedId || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                Merging...
              </>
            ) : (
              'Approve & Merge'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
