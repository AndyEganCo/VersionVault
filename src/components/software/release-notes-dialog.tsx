import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { ReleaseNote } from "@/lib/software/types";

type ReleaseNotesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  softwareName: string;
  releaseNotes: ReleaseNote[];
};

export function ReleaseNotesDialog({
  open,
  onOpenChange,
  softwareName,
  releaseNotes,
}: ReleaseNotesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{softwareName} Release Notes</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-6">
            {releaseNotes.map((note) => (
              <div key={note.version} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">Version {note.version}</h3>
                  <Badge variant={
                    note.type === 'major' ? 'default' :
                    note.type === 'minor' ? 'secondary' : 'outline'
                  }>
                    {note.type}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{note.date}</p>
                <ul className="list-disc list-inside space-y-1">
                  {note.notes.map((item, i) => (
                    <li key={i} className="text-sm">{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}