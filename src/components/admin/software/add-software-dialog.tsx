import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { createSoftware } from '@/lib/software/admin';

type AddSoftwareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void>;
};

type FormData = {
  name: string;
  website: string;
};

export function AddSoftwareDialog({ open, onOpenChange, onSuccess }: AddSoftwareDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    website: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Generate an ID from the name
      const id = formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      
      await createSoftware({
        id,
        name: formData.name,
        website: formData.website
      });
      
      await onSuccess();
      onOpenChange(false);
      setFormData({ name: '', website: '' });
      toast.success('Software added successfully');
    } catch (error) {
      console.error('Error adding software:', error);
      toast.error('Failed to add software');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ name: '', website: '' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Software</DialogTitle>
          <DialogDescription>
            Enter the software name and website URL. The system will automatically detect other details.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. ProPresenter"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://example.com"
              required
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Software'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}