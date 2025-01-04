import { RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

const frequencies = [
  {
    value: 'daily',
    title: 'Daily Update Summary',
    description: 'Get a daily digest of all updates'
  },
  {
    value: 'weekly',
    title: 'Weekly Update Digest',
    description: 'Receive a weekly summary every Monday'
  },
  {
    value: 'monthly',
    title: 'Monthly Update Overview',
    description: 'Get a comprehensive monthly report'
  }
] as const;

export function FrequencyOptions() {
  return (
    <div className="space-y-4">
      {frequencies.map(({ value, title, description }) => (
        <div key={value} className="flex items-center space-x-3">
          <RadioGroupItem value={value} id={value} />
          <Label htmlFor={value} className="flex flex-col">
            <span className="font-medium">{title}</span>
            <span className="text-sm text-muted-foreground">{description}</span>
          </Label>
        </div>
      ))}
    </div>
  );
}