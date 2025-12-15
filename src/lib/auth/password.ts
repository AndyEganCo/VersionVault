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

export async function requestPasswordReset(email: string): Promise<boolean> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw error;
    toast.success('Password reset email sent! Check your inbox.');
    return true;
  } catch (error) {
    console.error('Error requesting password reset:', error);
    toast.error('Failed to send password reset email');
    return false;
  }
}

export async function confirmPasswordReset(newPassword: string): Promise<boolean> {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;
    toast.success('Password reset successfully!');
    return true;
  } catch (error) {
    console.error('Error resetting password:', error);
    toast.error('Failed to reset password');
    return false;
  }
}