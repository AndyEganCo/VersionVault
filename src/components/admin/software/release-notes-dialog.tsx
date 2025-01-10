import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { addVersionHistory, getVersionHistory } from '@/lib/software/api';
import type { Software } from '@/lib/software/types';
import { Plus } from 'lucide-react';

interface ReleaseNotesDialogProps {
  software: Software;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void>;
}

function formatDateForInput(date: string): string {
  const d = new Date(date);
  return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`;
}

function parseDateString(dateString: string): string {
  // Convert MM/DD/YYYY to YYYY-MM-DD for database
  const [month, day, year] = dateString.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function ReleaseNotesDialog({
  software,
  open,
  onOpenChange,
  onSuccess
}: ReleaseNotesDialogProps) {
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<string>('');
  const [type, setType] = useState<'major' | 'minor' | 'patch'>('minor');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newVersion, setNewVersion] = useState('');
  const [releaseDate, setReleaseDate] = useState(formatDateForInput(new Date().toISOString()));

  useEffect(() => {
    async function loadVersionHistory() {
      if (open && software.id) {
        const history = await getVersionHistory(software.id);
        
        const currentVersionEntry = history.find(
          entry => entry.version === software.current_version
        );

        if (currentVersionEntry) {
          setType(currentVersionEntry.type);
          const noteText = Array.isArray(currentVersionEntry.notes)
            ? currentVersionEntry.notes.join('\n')
            : currentVersionEntry.notes;
          setNotes(noteText);
        } else {
          setType('minor');
          setNotes('');
        }
        setIsCreatingNew(false);
        setNewVersion('');
      }
    }
    loadVersionHistory();
  }, [open, software.id, software.current_version]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    
    // Add slashes as user types
    if (value.length >= 4) {
      value = value.slice(0, 2) + '/' + value.slice(2, 4) + '/' + value.slice(4, 8);
    } else if (value.length >= 2) {
      value = value.slice(0, 2) + '/' + value.slice(2);
    }
    
    // Limit to MM/DD/YYYY format
    if (value.length <= 10) {
      setReleaseDate(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const isoDate = parseDateString(releaseDate);
      const success = await addVersionHistory(software.id, {
        software_id: software.id,
        version: isCreatingNew ? newVersion : (software.current_version || ''),
        detected_at: new Date(isoDate).toISOString(),
        notes: notes,
        type
      });

      if (success) {
        onOpenChange(false);
        await onSuccess();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNewVersionClick = () => {
    setIsCreatingNew(true);
    setNotes('');
    setType('minor');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Release Notes for {software.name}</DialogTitle>
          <DialogDescription>
            {isCreatingNew 
              ? 'Add a new version with release notes'
              : `Add or edit release notes for version ${software.current_version}`
            }
          </DialogDescription>
        </DialogHeader>

        <form id="release-notes-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Version</Label>
              {!isCreatingNew && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleNewVersionClick}
                >
                  <Plus className="h-4 w-4 mr-1" />
                </Button>
              )}
            </div>
            {isCreatingNew ? (
              <Input
                value={newVersion}
                onChange={(e) => setNewVersion(e.target.value)}
                placeholder="Enter new version number"
                required
              />
            ) : (
              <Input
                value={software.current_version || ''}
                disabled
              />
            )}
          </div>
          <div className="space-y-2">
            <Label>Update Type</Label>
            <Select
              value={type}
              onValueChange={(value: 'major' | 'minor' | 'patch') => setType(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="major">Major</SelectItem>
                <SelectItem value="minor">Minor</SelectItem>
                <SelectItem value="patch">Patch</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Release Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter release notes (one per line)"
              rows={8}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Release Date</Label>
            <Input
              type="text"
              value={releaseDate}
              onChange={handleDateChange}
              placeholder="MM/DD/YYYY"
              pattern="\d{2}/\d{2}/\d{4}"
              required
            />
          </div>
        </form>

        <div className="flex justify-end space-x-2 pt-4 border-t mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setIsCreatingNew(false);
              onOpenChange(false);
            }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" form="release-notes-form" disabled={loading}>
            {loading ? 'Saving...' : isCreatingNew ? 'Save New Version' : 'Update Release Notes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 