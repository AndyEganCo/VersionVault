import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';

export function DeleteAccountForm() {
  const { deleteOwnAccount } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (
      !confirm(
        'Permanently delete your account? This cannot be undone. All your tracked software and settings will be erased. You can sign up again with the same email later, but nothing will be restored.'
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      await deleteOwnAccount();
      // On success the auth context redirects to /login -- no further action needed.
    } catch (error) {
      console.error('Failed to delete account:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete account'
      );
      setLoading(false);
    }
  };

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive">Delete Account</CardTitle>
        <CardDescription>
          Permanently delete your account and all associated data. This cannot be undone.
          You can sign up again with the same email if you change your mind, but your
          tracked software and settings will not be restored.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          variant="destructive"
          onClick={handleDelete}
          disabled={loading}
        >
          {loading ? 'Deleting...' : 'Delete my account'}
        </Button>
      </CardContent>
    </Card>
  );
}
