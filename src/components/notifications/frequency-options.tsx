import { RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Lock } from 'lucide-react';

const frequencies = [
  {
    value: 'daily',
    title: 'Daily Update Summary',
    description: 'Get a daily digest of all updates',
    proOnly: true,
  },
  {
    value: 'weekly',
    title: 'Weekly Update Digest',
    description: 'Receive a weekly summary every Monday',
    proOnly: false,
  },
  {
    value: 'monthly',
    title: 'Monthly Update Overview',
    description: 'Get a comprehensive monthly report',
    proOnly: true,
  },
] as const;

interface FrequencyOptionsProps {
  isPremium?: boolean;
}

export function FrequencyOptions({ isPremium = false }: FrequencyOptionsProps) {
  return (
    <div className="space-y-4">
      {frequencies.map(({ value, title, description, proOnly }) => {
        const locked = proOnly && !isPremium;
        return (
          <div key={value} className="flex items-center space-x-3">
            <RadioGroupItem value={value} id={value} disabled={locked} />
            <Label htmlFor={value} className={`flex flex-col cursor-pointer ${locked ? 'opacity-60' : ''}`}>
              <span className="font-medium flex items-center gap-2">
                {title}
                {locked && (
                  <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    <Lock className="h-3 w-3" />
                    Pro
                  </span>
                )}
              </span>
              <span className="text-sm text-muted-foreground">{description}</span>
            </Label>
          </div>
        );
      })}
      {!isPremium && (
        <p className="text-xs text-muted-foreground">
          <a href="/premium" className="text-primary hover:underline">Upgrade to Pro</a> to unlock daily and monthly notifications.
        </p>
      )}
    </div>
  );
}
