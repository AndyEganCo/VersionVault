import { supabase } from '@/lib/supabase';
import type { UserSettings } from '@/types/settings';

export async function getSettings(userId: string) {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data;
}

export async function updateSettings(userId: string, settings: UserSettings) {
  const { error } = await supabase
    .from('user_settings')
    .upsert({
      user_id: userId,
      ...settings,
      updated_at: new Date().toISOString()
    });

  if (error) throw error;
}