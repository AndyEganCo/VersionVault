import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { EmailPreferences } from '@/components/notifications/email-preferences';
import { getUserSettings, updateUserSettings, type UserSettings, NotificationFrequency } from '@/lib/settings';

export function UserNotifications() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<UserSettings>({
    emailNotifications: true,
    notificationFrequency: 'weekly',
    appUpdateNotifications: true,
    timezone: 'America/New_York',
  });

  useEffect(() => {
    async function loadPreferences() {
      if (!user) return;
      const settings = await getUserSettings(user.id);
      setPreferences(settings);
      setLoading(false);
    }

    loadPreferences();
  }, [user]);

  const handlePreferenceChange = async (key: string, value: boolean | NotificationFrequency | string): Promise<void> => {
    if (!user) return;

    setLoading(true);
    const success = await updateUserSettings(user.id, key as keyof UserSettings, value);
    
    if (success) {
      setPreferences(prev => ({ ...prev, [key]: value }));
    }
    
    setLoading(false);
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Email Preferences</h3>
        <p className="text-sm text-muted-foreground">
          Configure your email notification settings
        </p>
      </div>
      <EmailPreferences 
        preferences={preferences}
        onPreferenceChange={handlePreferenceChange}
        loading={loading}
      />
    </div>
  );
}