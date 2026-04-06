import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Crown, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UpgradePromptProps {
  title?: string;
  description?: string;
  showReferral?: boolean;
  compact?: boolean;
}

export function UpgradePrompt({
  title = 'Upgrade to Pro',
  description = 'Get unlimited app tracking, daily & monthly notifications, and more.',
  showReferral = true,
  compact = false,
}: UpgradePromptProps) {
  const navigate = useNavigate();

  if (compact) {
    return (
      <div className="flex items-center gap-3 text-sm bg-muted/50 rounded-md p-3">
        <Crown className="h-4 w-4 text-primary flex-shrink-0" />
        <span className="text-muted-foreground flex-1">{description}</span>
        <Button size="sm" variant="outline" onClick={() => navigate('/premium')}>
          Upgrade
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Crown className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Unlimited app tracking</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Daily, weekly, & monthly notifications</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={() => navigate('/premium')} className="w-full">
            Upgrade to Pro — $25/year
          </Button>
          {showReferral && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/user/referrals')} className="text-muted-foreground">
              <Users className="h-4 w-4 mr-1" />
              Or invite a friend for 1 month free
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
