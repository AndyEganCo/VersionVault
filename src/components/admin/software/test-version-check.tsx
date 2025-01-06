import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function TestVersionCheck() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    try {
      setLoading(true);
      setResult(null);

      const { data, error } = await supabase.functions.invoke('fetch-version', {
        body: { url },
      });

      if (error) throw error;

      setResult(data);
      
      if (!data.version) {
        toast.warning('No version found');
      } else {
        toast.success(`Found version: ${data.version}`);
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check version';
      toast.error(message);
      setResult({ error: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <h3 className="font-medium">Test Version Check</h3>
      <div className="flex gap-2">
        <Input 
          value={url} 
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter URL to test"
          className="flex-1"
          type="url"
          required
        />
        <Button 
          onClick={handleTest}
          disabled={loading || !url}
        >
          {loading ? 'Checking...' : 'Test URL'}
        </Button>
      </div>
      {result && (
        <pre className="p-4 bg-muted rounded-lg overflow-auto max-h-[200px] text-sm">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
} 