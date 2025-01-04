import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

export async function getActiveSession(): Promise<Session | null> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    // First clear all auth-related local storage
    const authKeys = [
      'versionvault.auth.token',
      'supabase.auth.token'
    ];
    authKeys.forEach(key => localStorage.removeItem(key));
    
    // Then clear session state
    await supabase.auth.clearSession();
    
    // Finally sign out globally
    const { error } = await supabase.auth.signOut({ 
      scope: 'global' 
    });
    
    if (error) throw error;
  } catch (error) {
    console.error('Error clearing session:', error);
    throw new Error('Failed to sign out completely');
  }
}

export async function verifySession(): Promise<boolean> {
  try {
    const session = await getActiveSession();
    if (!session) return false;

    // Verify session with a test query
    const { error } = await supabase
      .from('tracked_software')
      .select('count', { count: 'exact', head: true });

    return !error;
  } catch (error) {
    console.error('Session verification error:', error);
    return false;
  }
}