import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export async function updateEmail(currentEmail: string, newEmail: string, password: string): Promise<boolean> {
  try {
    // First verify the password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password
    });

    if (signInError) throw new Error('Current password is incorrect');

    // Update email
    const { error: updateError } = await supabase.auth.updateUser({
      email: newEmail
    });

    if (updateError) throw updateError;
    return true;
  } catch (error) {
    const err = error as Error;
    throw new Error(err.message);
  }
}