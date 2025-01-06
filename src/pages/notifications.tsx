import { useState } from 'react';
import { NotificationPreferences } from '@/components/notifications/notification-preferences';
import { EmailPreferences } from '@/components/notifications/email-preferences';
import { NotificationFrequency } from '@/lib/settings';

export type NotificationSettings = {
  emailNotifications: boolean;
  browserNotifications: boolean;
  notificationFrequency: NotificationFrequency;
  appUpdateNotifications: boolean;
};

export function NotificationsPage() {
  const [preferences, setPreferences] = useState<NotificationSettings>({
    emailNotifications: true,
    browserNotifications: true,
    notificationFrequency: 'daily',
    appUpdateNotifications: true
  });
  const [loading, setLoading] = useState(false);

  const handlePreferenceChange = (key: string, value: boolean | NotificationFrequency): void => {
    setLoading(true);
    try {
      setPreferences(prev => ({
        ...prev,
        [key]: value
      }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <NotificationPreferences 
        preferences={{
          emailNotifications: preferences.emailNotifications,
          browserNotifications: preferences.browserNotifications,
          notificationFrequency: preferences.notificationFrequency
        }}
        onPreferenceChange={handlePreferenceChange}
        loading={loading}
      />
      <EmailPreferences 
        preferences={{
          emailNotifications: preferences.emailNotifications,
          notificationFrequency: preferences.notificationFrequency,
          appUpdateNotifications: preferences.appUpdateNotifications
        }}
        onPreferenceChange={handlePreferenceChange}
        loading={loading}
      />
    </>
  );
}