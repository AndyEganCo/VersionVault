import { useState } from 'react';
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
import { supabase } from '@/lib/supabase';

interface FeatureRequestFormData {
  title: string;
  description: string;
  category?: string;
}

interface RequestFeatureModalProps {
  onSuccess?: () => void;
}

export function RequestFeatureModal({ onSuccess }: RequestFeatureModalProps): JSX.Element {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { user } = useAuth();

  const initialFormData: FeatureRequestFormData = {
    title: '',
    description: '',
    category: '',
  };

  const [formData, setFormData] = useState<FeatureRequestFormData>(initialFormData);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ): void => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('feature_requests')
        .insert([
          {
            title: formData.title,
            description: formData.description,
            category: formData.category || null,
            user_id: user?.id,
            status: 'pending',
            created_at: new Date().toISOString(),
          },
        ]);

      if (error) throw error;

      toast.success('Feature request submitted successfully');
      setFormData(initialFormData); // Clear form only on success
      setIsOpen(false);

      // Refresh the list
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      toast.error('Failed to submit feature request');
      console.error('Error submitting feature request:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Request New Feature</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Request a Feature</DialogTitle>
          <DialogDescription>
            Submit a request for a new feature or improvement to VersionVault.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Feature Title</Label>
            <Input
              id="title"
              name="title"
              placeholder="Add dark mode support"
              value={formData.title}
              onChange={handleInputChange}
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category (Optional)</Label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              disabled={isLoading}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select a category</option>
              <option value="ui">User Interface</option>
              <option value="functionality">Functionality</option>
              <option value="performance">Performance</option>
              <option value="integration">Integration</option>
              <option value="reporting">Reporting</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Describe the feature you'd like to see..."
              value={formData.description}
              onChange={handleInputChange}
              required
              disabled={isLoading}
              rows={5}
            />
            <p className="text-xs text-muted-foreground">
              Please provide as much detail as possible about the feature
            </p>
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
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
