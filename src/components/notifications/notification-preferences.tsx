import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, Globe } from 'lucide-react';
import { NotificationFrequency } from '@/lib/settings';
import { NotificationSettings } from '@/pages/notifications';

type NotificationPreferencesProps = {
  preferences: {
    emailNotifications: boolean;
    browserNotifications: boolean;
    notificationFrequency: NotificationFrequency;
  };
  onPreferenceChange: (key: keyof NotificationSettings, value: boolean | NotificationFrequency) => void;
  loading: boolean;
};

export function NotificationPreferences({ 
  preferences, 
  onPreferenceChange,
  loading 
}: NotificationPreferencesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Channels</CardTitle>
        <CardDescription>
          Choose how you want to receive notifications
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <NotificationChannel
            icon={<Globe className="h-5 w-5" />}
            title="Browser Notifications"
            description="Receive notifications in your browser"
            enabled={preferences.browserNotifications}
            onChange={(checked) => onPreferenceChange('browserNotifications', checked)}
            loading={loading}
          />
          <NotificationChannel
            icon={<Bell className="h-5 w-5" />}
            title="Email Notifications"
            description="Get updates directly to your inbox"
            enabled={preferences.emailNotifications}
            onChange={(checked) => onPreferenceChange('emailNotifications', checked)}
            loading={loading}
          />
        </div>
      </CardContent>
    </Card>
  );
}

type NotificationChannelProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onChange: (checked: boolean) => void;
  loading: boolean;
};

function NotificationChannel({ 
  icon, 
  title, 
  description, 
  enabled,
  onChange,
  loading 
}: NotificationChannelProps) {
  return (
    <div className="flex items-center justify-between space-x-4">
      <div className="flex items-center space-x-4">
        {icon}
        <div>
          <Label>{title}</Label>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch 
        checked={enabled}
        onCheckedChange={onChange}
        disabled={loading}
      />
    </div>
  );
}