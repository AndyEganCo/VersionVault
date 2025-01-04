export type UserSettings = {
  email_notifications: boolean;
  browser_notifications: boolean;
  update_frequency: 'daily' | 'weekly' | 'monthly';
};