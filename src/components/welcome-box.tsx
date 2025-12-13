import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const WELCOME_BOX_STORAGE_KEY = 'versionvault-new-user';

export function WelcomeBox() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user is new (set by auth callback)
    const isNewUser = localStorage.getItem(WELCOME_BOX_STORAGE_KEY);
    setIsVisible(isNewUser === 'true');
  }, []);

  const handleDismiss = () => {
    localStorage.removeItem(WELCOME_BOX_STORAGE_KEY);
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <Alert className="mb-6 border-green-500/50 bg-green-500/10">
      <Sparkles className="h-4 w-4 text-green-500" />
      <div className="flex items-start justify-between gap-4">
        <AlertDescription className="text-sm leading-relaxed">
          <span className="font-semibold block mb-2">Welcome to VersionVault! 🎉</span>
          <span className="block mb-2">
            So the quick version: Sign up, pick software to track, get emails with new versions—daily, weekly, or monthly, you pick.
          </span>
          <span className="block">
            Send any feedback or request software that isn't there and I'll add it.
          </span>
        </AlertDescription>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 opacity-70 hover:opacity-100"
          onClick={handleDismiss}
          aria-label="Dismiss welcome message"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
}
