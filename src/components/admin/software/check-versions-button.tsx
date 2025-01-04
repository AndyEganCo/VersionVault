import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { checkVersions } from '@/lib/software/api';
import { toast } from 'sonner';

export function CheckVersionsButton() {
  const [loading, setLoading] = useState(false);

  const handleCheck = async () => {
    try {
      setLoading(true);
      await checkVersions();
      toast.success('Version check completed');
    } catch (error) {
      console.error('Version check failed:', error);
      toast.error('Failed to check versions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleCheck} 
      disabled={loading}
      variant="outline"
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Checking Versions...
        </>
      ) : (
        'Check All Versions'
      )}
    </Button>
  );
} 