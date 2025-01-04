import { NotificationPreferences } from '@/components/notifications/notification-preferences';
import { EmailPreferences } from '@/components/notifications/email-preferences';

export function Notifications() {
  return (
    <div className="space-y-6">
      <NotificationPreferences />
      <EmailPreferences />
    </div>
  );
}