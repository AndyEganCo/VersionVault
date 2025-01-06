import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { updateUserMetadata, getUserMetadata } from '@/lib/auth/metadata';
import type { UserMetadata } from '@/lib/auth/types';

export function ProfileForm() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState<UserMetadata>({
    full_name: '',
    phone: ''
  });

  useEffect(() => {
    async function loadMetadata() {
      const data = await getUserMetadata();
      if (data) {
        setMetadata({
          full_name: data.full_name || '',
          phone: data.phone || ''
        });
      }
    }
    
    loadMetadata();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    await updateUserMetadata(metadata);
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>Update your personal information</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              value={metadata.full_name}
              onChange={(e) => setMetadata({ ...metadata, full_name: e.target.value })}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={metadata.phone}
              onChange={(e) => setMetadata({ ...metadata, phone: e.target.value })}
              disabled={loading}
            />
          </div>
          <Button type="submit" disabled={loading || !user}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}