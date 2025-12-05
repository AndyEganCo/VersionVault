import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Common timezones grouped by region
const TIMEZONES = [
  // Americas
  { value: 'America/New_York', label: 'Eastern Time (ET)', region: 'Americas' },
  { value: 'America/Chicago', label: 'Central Time (CT)', region: 'Americas' },
  { value: 'America/Denver', label: 'Mountain Time (MT)', region: 'Americas' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', region: 'Americas' },
  { value: 'America/Anchorage', label: 'Alaska Time', region: 'Americas' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time', region: 'Americas' },
  { value: 'America/Toronto', label: 'Toronto', region: 'Americas' },
  { value: 'America/Vancouver', label: 'Vancouver', region: 'Americas' },
  { value: 'America/Mexico_City', label: 'Mexico City', region: 'Americas' },
  { value: 'America/Sao_Paulo', label: 'São Paulo', region: 'Americas' },

  // Europe
  { value: 'Europe/London', label: 'London (GMT/BST)', region: 'Europe' },
  { value: 'Europe/Paris', label: 'Paris (CET)', region: 'Europe' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)', region: 'Europe' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam (CET)', region: 'Europe' },
  { value: 'Europe/Rome', label: 'Rome (CET)', region: 'Europe' },
  { value: 'Europe/Madrid', label: 'Madrid (CET)', region: 'Europe' },
  { value: 'Europe/Stockholm', label: 'Stockholm (CET)', region: 'Europe' },
  { value: 'Europe/Moscow', label: 'Moscow', region: 'Europe' },

  // Asia/Pacific
  { value: 'Asia/Dubai', label: 'Dubai', region: 'Asia/Pacific' },
  { value: 'Asia/Kolkata', label: 'India (IST)', region: 'Asia/Pacific' },
  { value: 'Asia/Singapore', label: 'Singapore', region: 'Asia/Pacific' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong', region: 'Asia/Pacific' },
  { value: 'Asia/Shanghai', label: 'Shanghai', region: 'Asia/Pacific' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)', region: 'Asia/Pacific' },
  { value: 'Asia/Seoul', label: 'Seoul (KST)', region: 'Asia/Pacific' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)', region: 'Asia/Pacific' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST)', region: 'Asia/Pacific' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST)', region: 'Asia/Pacific' },

  // UTC
  { value: 'UTC', label: 'UTC', region: 'Other' },
];

interface TimezoneSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function TimezoneSelector({ value, onChange, disabled }: TimezoneSelectorProps) {
  // Group timezones by region
  const regions = ['Americas', 'Europe', 'Asia/Pacific', 'Other'];

  // Get current time in selected timezone
  const getCurrentTime = () => {
    try {
      return new Date().toLocaleTimeString('en-US', {
        timeZone: value,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Timezone</Label>
        <span className="text-xs text-muted-foreground">
          Current time: {getCurrentTime()}
        </span>
      </div>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder="Select timezone" />
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {regions.map((region) => (
            <div key={region}>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted">
                {region}
              </div>
              {TIMEZONES.filter((tz) => tz.region === region).map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Digest emails will be sent at 8:00 AM in your selected timezone
      </p>
    </div>
  );
}
