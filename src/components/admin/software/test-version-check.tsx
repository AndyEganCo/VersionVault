import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';

export function TestVersionCheck() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    try {
      setLoading(true);
      const { data, error: apiError } = await supabase.functions.invoke('fetch-version', {
        body: { url }
      });

      if (apiError) {
        throw new Error(apiError.message);
      }

      setResult(data);
      console.log('Version check result:', data);
    } catch (err) {
      const error = err as Error;
      console.error('Test failed:', error);
      setResult({ error: error.message });
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
        />
        <Button 
          onClick={handleTest}
          disabled={loading || !url}
        >
          {loading ? 'Checking...' : 'Test URL'}
        </Button>
      </div>
      {result && (
        <pre className="p-4 bg-muted rounded-lg overflow-auto max-h-[200px]">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
} 