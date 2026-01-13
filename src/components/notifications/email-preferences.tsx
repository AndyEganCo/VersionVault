import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/auth-context';
import { NotificationFrequency, AllQuietPreference } from '@/lib/settings';
import { FrequencyOptions } from './frequency-options';
import { TimezoneSelector } from './timezone-selector';

type EmailPreferencesProps = {
  preferences: {
    emailNotifications: boolean;
    notificationFrequency: NotificationFrequency;
    appUpdateNotifications: boolean;
    timezone: string;
    allQuietPreference: AllQuietPreference;
  };
  onPreferenceChange: (key: string, value: boolean | NotificationFrequency | AllQuietPreference | string) => void;
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

              <div className="space-y-4 pt-4">
                <Label>All Quiet Email Preference</Label>
                <p className="text-sm text-muted-foreground">
                  Control when you receive "all quiet" emails when there are no version updates
                </p>
                <RadioGroup
                  value={preferences.allQuietPreference}
                  onValueChange={(value) => onPreferenceChange('allQuietPreference', value as AllQuietPreference)}
                  disabled={loading}
                >
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="always" id="always" />
                    <Label htmlFor="always" className="flex flex-col cursor-pointer">
                      <span className="font-medium">Always send</span>
                      <span className="text-sm text-muted-foreground">You'll know when everything is up to date</span>
                    </Label>
                  </div>

                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="new_software_only" id="new_software_only" />
                    <Label htmlFor="new_software_only" className="flex flex-col cursor-pointer">
                      <span className="font-medium">Only when new software is available</span>
                      <span className="text-sm text-muted-foreground">Stay informed about new additions to the platform</span>
                    </Label>
                  </div>

                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="never" id="never" />
                    <Label htmlFor="never" className="flex flex-col cursor-pointer">
                      <span className="font-medium">Never send</span>
                      <span className="text-sm text-muted-foreground">Only notify me about version updates to my tracked software</span>
                    </Label>
                  </div>
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

              <div className="pt-4">
                <TimezoneSelector
                  value={preferences.timezone}
                  onChange={(value) => onPreferenceChange('timezone', value)}
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