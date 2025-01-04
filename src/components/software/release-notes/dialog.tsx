import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ReleaseNotesList } from "./list";
import type { ReleaseNote } from "@/lib/software/release-notes/types";

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
          <ReleaseNotesList notes={releaseNotes} />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}