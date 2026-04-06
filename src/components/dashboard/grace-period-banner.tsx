import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FREE_TIER_TRACKING_LIMIT } from '@/lib/software/utils/tracking';

interface GracePeriodBannerProps {
  trackedCount: number;
}

export function GracePeriodBanner({ trackedCount }: GracePeriodBannerProps) {
  const { user, isPremium } = useAuth();
  const navigate = useNavigate();
  const [gracePeriodStart, setGracePeriodStart] = useState<Date | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkGracePeriod() {
      if (!user || isPremium) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await supabase
          .from('user_settings')
          .select('grace_period_start')
          .eq('user_id', user.id)
          .maybeSingle();

        if (data?.grace_period_start) {
          setGracePeriodStart(new Date(data.grace_period_start));
        }
      } catch (error) {
        console.error('Error checking grace period:', error);
      } finally {
        setLoading(false);
      }
    }

    checkGracePeriod();
  }, [user, isPremium]);

  if (loading || dismissed || !gracePeriodStart || isPremium || trackedCount <= FREE_TIER_TRACKING_LIMIT) {
    return null;
  }

  const expiresAt = new Date(gracePeriodStart.getTime() + 30 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const daysLeft = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));

  if (daysLeft <= 0) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left to choose your {FREE_TIER_TRACKING_LIMIT} apps
          </p>
          <p className="text-sm text-amber-800 dark:text-amber-300">
            You're tracking {trackedCount} apps. Free accounts are limited to {FREE_TIER_TRACKING_LIMIT}.
            After {expiresAt.toLocaleDateString()}, we'll keep your {FREE_TIER_TRACKING_LIMIT} most recently tracked apps.
          </p>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={() => navigate('/premium')}>
              Upgrade to Pro
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/dashboard')}>
              Manage Apps
            </Button>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
