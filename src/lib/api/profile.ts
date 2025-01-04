import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/profile';

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data;
}

export async function updateProfile(userId: string, profile: Profile) {
  const { error } = await supabase
    .from('profiles')
    .upsert({
      user_id: userId,
      ...profile,
      updated_at: new Date().toISOString()
    });

  if (error) throw error;
}