import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { SoftwareRequestFormData } from '@/types/software';
import { supabase } from '@/lib/supabase';

interface RequestSoftwareModalProps {
  onSuccess?: () => void;
}

export function RequestSoftwareModal({ onSuccess }: RequestSoftwareModalProps): JSX.Element {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { user } = useAuth();

  const initialFormData: SoftwareRequestFormData = {
    name: '',
    website: '',
    versionUrl: '',
    description: '',
  };

  const [formData, setFormData] = useState<SoftwareRequestFormData>(initialFormData);

  // Clear form whenever modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData(initialFormData);
    }
  }, [isOpen]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ): void => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('software_requests')
        .insert([
          {
            name: formData.name,
            website: formData.website,
            version_url: formData.versionUrl,
            description: formData.description || null,
            user_id: user?.id,
            status: 'pending',
            created_at: new Date().toISOString(),
          },
        ]);

      if (error) throw error;

      toast.success('Software request submitted successfully');
      setFormData(initialFormData); // Clear form only on success
      setIsOpen(false);

      // Refresh the list
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      toast.error('Failed to submit software request');
      console.error('Error submitting software request:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData(initialFormData); // Clear form when canceling
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Request New Software</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Request Software Tracking</DialogTitle>
          <DialogDescription>
            Submit a request to track a new software's version updates.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Software Name</Label>
            <Input
              id="name"
              name="name"
              placeholder="ProPresenter"
              value={formData.name}
              onChange={handleInputChange}
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Official Website</Label>
            <Input
              id="website"
              name="website"
              type="url"
              placeholder="https://example.com"
              value={formData.website}
              onChange={handleInputChange}
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="versionUrl">Version Check URL</Label>
            <Input
              id="versionUrl"
              name="versionUrl"
              type="url"
              placeholder="https://example.com/download"
              value={formData.versionUrl}
              onChange={handleInputChange}
              required
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              URL where version information can be found
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Additional Information</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Any additional details that might help..."
              value={formData.description}
              onChange={handleInputChange}
              disabled={isLoading}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 