import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export type ProfileData = {
  full_name?: string;
  phone?: string;
};

export async function updateProfile(data: ProfileData): Promise<boolean> {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) {
      toast.error('Please sign in again');
      return false;
    }

    const { error } = await supabase.auth.updateUser({
      data: {
        ...session.session.user.user_metadata,
        ...data
      }
    });

    if (error) throw error;
    toast.success('Profile updated successfully');
    return true;
  } catch (error) {
    console.error('Error updating profile:', error);
    toast.error('Failed to update profile');
    return false;
  }
}