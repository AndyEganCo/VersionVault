import { supabase } from '@/lib/supabase';
import { UserMetadata } from './types';
import { getActiveSession } from './session';
import { toast } from 'sonner';

export async function getUserMetadata(): Promise<UserMetadata | null> {
  try {
    const session = await getActiveSession();
    if (!session) return null;
    return session.user?.user_metadata || null;
  } catch (error) {
    console.error('Error getting user metadata:', error);
    return null;
  }
}

export async function updateUserMetadata(metadata: Partial<UserMetadata>): Promise<boolean> {
  try {
    const session = await getActiveSession();
    if (!session) {
      toast.error('Please sign in to update your profile');
      return false;
    }

    const { error } = await supabase.auth.updateUser({
      data: {
        ...session.user.user_metadata,
        ...metadata,
        updated_at: new Date().toISOString()
      }
    });

    if (error) throw error;
    
    toast.success('Profile updated successfully');
    return true;
  } catch (error) {
    console.error('Error updating user metadata:', error);
    toast.error('Failed to update profile');
    return false;
  }
}