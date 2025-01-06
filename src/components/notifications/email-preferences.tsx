import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/auth-context';
import { NotificationFrequency } from '@/lib/settings';
import { FrequencyOptions } from './frequency-options';

type EmailPreferencesProps = {
  preferences: {
    emailNotifications: boolean;
    notificationFrequency: NotificationFrequency;
    appUpdateNotifications: boolean;
  };
  onPreferenceChange: (key: string, value: boolean | NotificationFrequency) => void;
  loading: boolean;
};

export function EmailPreferences({ preferences, onPreferenceChange, loading }: EmailPreferencesProps) {
  const { user } = useAuth();

  return (
    <Card className="p-5">
      <CardContent className="p-2 space-y-6">
        <div className="space-y-2">
          <Label>Email Address</Label>
          <div className="text-sm text-muted-foreground">
            {user?.email || 'No email set'}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Enable or disable all email notifications
              </p>
            </div>
            <Switch
              checked={preferences.emailNotifications}
              onCheckedChange={(checked) => onPreferenceChange('emailNotifications', checked)}
              disabled={loading}
            />
          </div>

          {preferences.emailNotifications && (
            <>
              <div className="space-y-4 pt-4">
                <Label>Notification Frequency</Label>
                <RadioGroup
                  value={preferences.notificationFrequency}
                  onValueChange={(value) => onPreferenceChange('notificationFrequency', value as NotificationFrequency)}
                  disabled={loading}
                >
                  <FrequencyOptions />
                </RadioGroup>
              </div>

              <div className="flex items-center justify-between pt-4">
                <div>
                  <Label>App Update Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive detailed release notes for all app updates
                  </p>
                </div>
                <Switch
                  checked={preferences.appUpdateNotifications}
                  onCheckedChange={(checked) => onPreferenceChange('appUpdateNotifications', checked)}
                  disabled={loading}
                />
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}