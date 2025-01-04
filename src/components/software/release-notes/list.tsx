import { Badge } from "@/components/ui/badge";
import type { ReleaseNote } from "@/lib/software/release-notes/types";

type ReleaseNotesListProps = {
  notes: ReleaseNote[];
};

export function ReleaseNotesList({ notes }: ReleaseNotesListProps) {
  if (!notes.length) {
    return (
      <p className="text-center text-muted-foreground py-4">
        No release notes available
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {notes.map((note) => (
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
  );
}