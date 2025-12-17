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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { softwareCategories } from '@/data/software-categories';
import { toast } from 'sonner';
import { updateSoftware } from '@/lib/software/api/admin';
import type { Software, SourceType, ForumConfig } from '@/lib/software/types';

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
        version_website: software.version_website || '',
        source_type: software.source_type || 'webpage',
        forum_config: software.forum_config || {}
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
          <div className="space-y-2">
            <Label htmlFor="source_type">Source Type</Label>
            <Select
              value={formData.source_type as SourceType || 'webpage'}
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
                  value={(formData.forum_config as ForumConfig)?.forumType || 'phpbb'}
                  onValueChange={(value) => setFormData({
                    ...formData,
                    forum_config: { ...(formData.forum_config as ForumConfig || {}), forumType: value as 'phpbb' | 'discourse' | 'generic' }
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
                  value={(formData.forum_config as ForumConfig)?.titlePattern || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    forum_config: { ...(formData.forum_config as ForumConfig || {}), titlePattern: e.target.value }
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
                  value={(formData.forum_config as ForumConfig)?.officialAuthor || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    forum_config: { ...(formData.forum_config as ForumConfig || {}), officialAuthor: e.target.value }
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
                  checked={(formData.forum_config as ForumConfig)?.stickyOnly || false}
                  onChange={(e) => setFormData({
                    ...formData,
                    forum_config: { ...(formData.forum_config as ForumConfig || {}), stickyOnly: e.target.checked }
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