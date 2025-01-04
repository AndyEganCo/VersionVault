import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export async function updatePassword(newPassword: string): Promise<boolean> {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating password:', error);
    toast.error('Failed to update password');
    return false;
  }
}