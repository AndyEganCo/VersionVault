import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { deleteSoftware } from '@/lib/software/api/admin';
import type { Software } from '@/lib/software/types';

type DeleteSoftwareDialogProps = {
  software: Software | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void>;
};

export function DeleteSoftwareDialog({ software, open, onOpenChange, onSuccess }: DeleteSoftwareDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!software) return;

    setLoading(true);
    try {
      await deleteSoftware(software.id);
      onOpenChange(false);
      toast.success('Software deleted successfully');
      await onSuccess();
    } catch (error) {
      console.error('Delete error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete software';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!software) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Software</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete {software.name}? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}