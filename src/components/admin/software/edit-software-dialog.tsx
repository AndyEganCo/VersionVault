import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { softwareCategories } from '@/data/software-categories';
import { toast } from 'sonner';
import { updateSoftware } from '@/lib/software/admin';
import type { Software } from '@/lib/software/types';

type EditSoftwareDialogProps = {
  software: Software | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void>;
};

export function EditSoftwareDialog({ 
  software, 
  open, 
  onOpenChange,
  onSuccess 
}: EditSoftwareDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Software>>({});

  useEffect(() => {
    if (software) {
      setFormData({
        name: software.name,
        category: software.category,
        manufacturer: software.manufacturer,
        website: software.website,
        version_website: software.version_website || ''
      });
    }
  }, [software]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!software) return;
    
    setLoading(true);
    try {
      await updateSoftware(software.id, formData);
      await onSuccess();
      onOpenChange(false);
      toast.success('Software updated successfully');
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Failed to update software');
    } finally {
      setLoading(false);
    }
  };

  if (!software) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Software</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              list="category-suggestions"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="Type or select a category"
              required
            />
            <datalist id="category-suggestions">
              {Object.values(softwareCategories).map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground">
              Select from suggestions or type a custom category
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="manufacturer">Manufacturer</Label>
            <Input
              id="manufacturer"
              value={formData.manufacturer}
              onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
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
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="version_website">Version Webpage</Label>
            <Input
              id="version_website"
              type="url"
              value={formData.version_website}
              onChange={(e) => setFormData({ ...formData, version_website: e.target.value })}
              placeholder="https://example.com/versions"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}