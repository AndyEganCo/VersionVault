import { supabase } from './supabase';
import { toast } from 'sonner';

export type NotificationFrequency = 'daily' | 'weekly' | 'monthly';
export type AllQuietPreference = 'always' | 'new_software_only' | 'never';

export type UserSettings = {
  emailNotifications: boolean;
  notificationFrequency: NotificationFrequency;
  appUpdateNotifications: boolean;
  timezone: string;
  allQuietPreference: AllQuietPreference;
};

const DEFAULT_SETTINGS: UserSettings = {
  emailNotifications: true,
  notificationFrequency: 'weekly',
  appUpdateNotifications: true,
  timezone: 'America/New_York',
  allQuietPreference: 'always',
};

export async function getUserSettings(userId: string): Promise<UserSettings> {
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!data) {
      const { data: newData, error: insertError } = await supabase
        .from('user_settings')
        .insert({
          user_id: userId,
          ...DEFAULT_SETTINGS
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return newData;
    }

    if (error) throw error;
    return {
      emailNotifications: data.email_notifications,
      notificationFrequency: data.notification_frequency,
      appUpdateNotifications: data.app_update_notifications,
      timezone: data.timezone || DEFAULT_SETTINGS.timezone,
      allQuietPreference: data.all_quiet_preference || DEFAULT_SETTINGS.allQuietPreference,
    };
  } catch (error) {
    console.error('Error loading user settings:', error);
    toast.error('Failed to load settings');
    return DEFAULT_SETTINGS;
  }
}

export async function updateUserSettings(
  userId: string,
  key: keyof UserSettings,
  value: boolean | NotificationFrequency | AllQuietPreference | string
): Promise<boolean> {
  try {
    const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        [dbKey]: value
      }, {
        onConflict: 'user_id'
      });

    if (error) throw error;
    toast.success('Settings updated');
    return true;
  } catch (error) {
    console.error('Error updating user settings:', error);
    toast.error('Failed to update settings');
    return false;
  }
}