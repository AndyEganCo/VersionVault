import { NotificationPreferences } from '@/components/notifications/notification-preferences';
import { EmailPreferences } from '@/components/notifications/email-preferences';
import { useState } from 'react';

export function NotificationsPage() {
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    pushNotifications: true
  });
  const [loading, setLoading] = useState(false);

  const handlePreferenceChange = async (key: string, value: boolean) => {
    setLoading(true);
    // Update preferences logic here
    setLoading(false);
  };

  return (
    <>
      <NotificationPreferences 
        preferences={preferences}
        onPreferenceChange={handlePreferenceChange}
        loading={loading}
      />
      <EmailPreferences 
        preferences={preferences}
        onPreferenceChange={handlePreferenceChange}
        loading={loading}
      />
    </>
  );
}