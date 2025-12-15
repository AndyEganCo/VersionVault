import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { X, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const BETA_BANNER_STORAGE_KEY = 'versionvault-beta-banner-dismissed';

export function BetaBanner() {
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    // Check if banner was previously dismissed
    const dismissed = localStorage.getItem(BETA_BANNER_STORAGE_KEY);
    setIsDismissed(dismissed === 'true');
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(BETA_BANNER_STORAGE_KEY, 'true');
    setIsDismissed(true);
  };

  if (isDismissed) {
    return null;
  }

  return (
    <Alert className="mb-6 border-blue-500/50 bg-blue-500/10">
      <Info className="h-4 w-4 text-blue-500" />
      <div className="flex items-start justify-between gap-4">
        <AlertDescription className="text-sm leading-relaxed">
          Thanks for trying VersionVault Beta! Help shape the future of VersionVault!{' '}
          <Link to="/requests" className="font-semibold underline hover:text-blue-600 transition-colors">
            Request features or software you'd like to see included.
          </Link>
        </AlertDescription>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 opacity-70 hover:opacity-100"
          onClick={handleDismiss}
          aria-label="Dismiss beta banner"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
}
