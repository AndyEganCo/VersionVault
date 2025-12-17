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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { softwareCategories } from '@/data/software-categories';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { SourceType, ForumConfig } from '@/lib/software/types';

type AddSoftwareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void>;
};

type FormData = {
  name: string;
  website: string;
  category: string;
  manufacturer: string;
  version_website: string;
  source_type: SourceType;
  forum_config: ForumConfig;
};

export function AddSoftwareDialog({ open, onOpenChange, onSuccess }: AddSoftwareDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    website: '',
    category: 'Show Control',
    manufacturer: '',
    version_website: '',
    source_type: 'webpage',
    forum_config: {}
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Generate an ID from the name
      const id = crypto.randomUUID();

      const { error } = await supabase
        .from('software')
        .insert([{
          id,
          name: formData.name,
          website: formData.website,
          category: formData.category,
          manufacturer: formData.manufacturer,
          version_website: formData.version_website || null,
          source_type: formData.source_type,
          forum_config: formData.source_type === 'forum' && Object.keys(formData.forum_config).length > 0
            ? formData.forum_config
            : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);

      if (error) throw error;

      await onSuccess();
      onOpenChange(false);
      setFormData({
        name: '',
        website: '',
        category: 'Show Control',
        manufacturer: '',
        version_website: '',
        source_type: 'webpage',
        forum_config: {}
      });
      toast.success('Software added successfully');
    } catch (error) {
      console.error('Error adding software:', error);
      toast.error('Failed to add software');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      website: '',
      category: 'Show Control',
      manufacturer: '',
      version_website: '',
      source_type: 'webpage',
      forum_config: {}
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Software</DialogTitle>
          <DialogDescription>
            Enter the software details to start tracking it.
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
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              list="category-suggestions-add"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="Type or select a category"
              required
            />
            <datalist id="category-suggestions-add">
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
              placeholder="e.g. Renewed Vision"
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
          <div className="space-y-2">
            <Label htmlFor="version_website">Version Webpage (Optional)</Label>
            <Input
              id="version_website"
              type="url"
              value={formData.version_website}
              onChange={(e) => setFormData({ ...formData, version_website: e.target.value })}
              placeholder="https://example.com/downloads"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="source_type">Source Type</Label>
            <Select
              value={formData.source_type}
              onValueChange={(value: SourceType) => setFormData({ ...formData, source_type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select source type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="webpage">Webpage</SelectItem>
                <SelectItem value="rss">RSS Feed</SelectItem>
                <SelectItem value="forum">Forum</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              How version information should be fetched
            </p>
          </div>
          {formData.source_type === 'forum' && (
            <div className="space-y-3 border rounded-lg p-3 bg-muted/50">
              <div className="font-medium text-sm">Forum Configuration</div>
              <div className="space-y-2">
                <Label htmlFor="forumType">Forum Type</Label>
                <Select
                  value={formData.forum_config.forumType || 'phpbb'}
                  onValueChange={(value) => setFormData({
                    ...formData,
                    forum_config: { ...formData.forum_config, forumType: value as 'phpbb' | 'discourse' | 'generic' }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select forum type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phpbb">phpBB</SelectItem>
                    <SelectItem value="discourse">Discourse</SelectItem>
                    <SelectItem value="generic">Generic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="titlePattern">Title Pattern (Regex)</Label>
                <Input
                  id="titlePattern"
                  value={formData.forum_config.titlePattern || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    forum_config: { ...formData.forum_config, titlePattern: e.target.value }
                  })}
                  placeholder="e.g. ^Release of"
                />
                <p className="text-xs text-muted-foreground">
                  Filter topics by title pattern
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="officialAuthor">Official Author</Label>
                <Input
                  id="officialAuthor"
                  value={formData.forum_config.officialAuthor || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    forum_config: { ...formData.forum_config, officialAuthor: e.target.value }
                  })}
                  placeholder="e.g. Blackmagic"
                />
                <p className="text-xs text-muted-foreground">
                  Filter by author username
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="stickyOnly"
                  checked={formData.forum_config.stickyOnly || false}
                  onChange={(e) => setFormData({
                    ...formData,
                    forum_config: { ...formData.forum_config, stickyOnly: e.target.checked }
                  })}
                  className="rounded"
                />
                <Label htmlFor="stickyOnly" className="text-sm cursor-pointer">
                  Sticky/Pinned topics only
                </Label>
              </div>
            </div>
          )}
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