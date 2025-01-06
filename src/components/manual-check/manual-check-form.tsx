import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { checkVersion } from '@/lib/version-check';
import { ScrapeStatus } from '@/types/scrape';
import { softwareList } from '@/data/software-list';
import { useAuth } from '@/contexts/auth-context';

type ManualCheckFormProps = {
  onStatusChange: (status: ScrapeStatus) => void;
};

export function ManualCheckForm({ onStatusChange }: ManualCheckFormProps) {
  const { user } = useAuth();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please sign in to check versions');
      return;
    }

    if (!url) {
      toast.error('Please enter a URL');
      return;
    }

    setLoading(true);
    try {
      const result = await checkVersion(url);
      const software = softwareList.find(s => s.website === url);
      
      const status: ScrapeStatus = {
        success: result.success,
        version: result.version,
        source: result.source,
        content: `Source: ${result.source}\nConfidence: ${result.confidence}`,
        softwareName: software?.name || 'Unknown Software',
        currentVersion: software?.currentVersion,
        error: result.error,
        confidence: result.confidence
      };

      onStatusChange(status);

      if (result.success) {
        toast.success('Version check completed');
      } else {
        toast.error('Version check failed');
      }
    } catch (error) {
      console.error('Version check error:', error);
      toast.error('Failed to check version');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Check Version</CardTitle>
        <CardDescription>
          Enter a software URL to check its current version
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">Software URL</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Quick Links</Label>
            <div className="grid grid-cols-2 gap-2">
              {softwareList.slice(0, 4).map((software) => (
                <Button
                  key={software.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() => setUrl(software.website)}
                >
                  {software.name}
                </Button>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Checking...
              </>
            ) : (
              'Check Version'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}