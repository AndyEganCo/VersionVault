import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { updateEmail } from '@/lib/auth/email';

type EmailFormProps = {
  currentEmail: string;
};

export function EmailForm({ currentEmail }: EmailFormProps) {
  const [loading, setLoading] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const success = await updateEmail(currentEmail, newEmail, password);
    if (success) {
      toast.success('Verification email sent to your new address');
      setNewEmail('');
      setPassword('');
    }
    
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Address</CardTitle>
        <CardDescription>Update your email address</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current_email">Current Email</Label>
            <Input
              id="current_email"
              value={currentEmail}
              disabled
              className="bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new_email">New Email</Label>
            <Input
              id="new_email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm_password">Current Password</Label>
            <Input
              id="confirm_password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? 'Sending Verification...' : 'Update Email'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}